# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "pandas",
#     "odfpy",
#     "openpyxl",
# ]
# ///
"""Extract tickers from column A of every sheet of the files in input/
and write them as a single comma-separated line.

Run with: uv run main.py
"""

from pathlib import Path

import pandas as pd

INPUT_DIR = Path(__file__).parent / "input"
OUTPUT_FILE = Path(__file__).parent / "tickers.txt"

SUPPORTED_SUFFIXES = {".csv", ".ods", ".xlsx", ".xls"}


def tickers_from_file(path: Path) -> dict[str, list[str]]:
    """Return {sheet name: column A values} for every sheet of the given file."""
    if path.suffix.lower() == ".csv":
        sheets = {path.stem: pd.read_csv(path, header=None, usecols=[0])}
    else:
        sheets = pd.read_excel(path, sheet_name=None, header=None, usecols=[0])

    result = {}
    for sheet_name, df in sheets.items():
        if df.empty:
            print(f"  - sheet '{sheet_name}': empty, skipped")
            continue
        values = df.iloc[:, 0].dropna().astype(str).str.strip()
        values = values[values != ""].tolist()
        # Skip a header row like "Symbol" or "Ticker" (some sheets have none)
        if values and values[0].lower() in {"symbol", "symbols", "ticker", "tickers"}:
            values = values[1:]
        print(f"  - sheet '{sheet_name}': {len(values)} tickers")
        result[sheet_name] = values
    return result


def main() -> None:
    files = sorted(
        p for p in INPUT_DIR.iterdir()
        if p.suffix.lower() in SUPPORTED_SUFFIXES and not p.name.startswith("~")
    )
    if not files:
        raise SystemExit(f"No csv/ods/xlsx files found in {INPUT_DIR}")

    sections: list[str] = []
    total = 0
    for path in files:
        print(f"{path.name}:")
        for sheet_name, tickers in tickers_from_file(path).items():
            label = sheet_name if len(files) == 1 else f"{path.name} / {sheet_name}"
            title = f"{label}  ({len(tickers)} tickers)"
            sections.append(f"{title}\n{'-' * len(title)}\n{','.join(tickers)}")
            total += len(tickers)

    OUTPUT_FILE.write_text("\n\n\n".join(sections) + "\n", encoding="utf-8")
    print(f"\nTotal: {total} tickers -> {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
