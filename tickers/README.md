# tickers

Extracts stock tickers from spreadsheet files and flattens them into
comma-separated lines, grouped by sheet.

## Usage

1. Drop one or more spreadsheet files (`.ods`, `.xlsx`, `.xls`, or `.csv`)
   into the `input/` directory.
2. Run:

   ```sh
   uv run main.py
   ```

3. The result is written to `tickers.txt`.

Dependencies (pandas, odfpy, openpyxl) are declared inline in `main.py`
([PEP 723](https://peps.python.org/pep-0723/)), so [uv](https://docs.astral.sh/uv/)
installs them automatically — no manual setup needed.

## How it works

- Reads **column A** of every sheet in every supported file in `input/`.
- Skips blank cells and header rows named `Symbol`/`Ticker` (case-insensitive).
- Keeps duplicates: a ticker appearing on several sheets is listed in each.

## Output format

One section per sheet — the sheet name and ticker count, underlined by a
full-width rule, then that sheet's tickers on a single comma-separated line:

```
strong buys - up 20%  (8 tickers)
---------------------------------
RBA,CRGY,VOYA,AAPL,NCLH,BKNG,AESI,QDEL


dividend  (13 tickers)
----------------------
CMCSA,VZ,VICI,VRTS,GIS,ETD,AMCR,O,CLX,TROW,KMB,HRL,KVUE
```

If `input/` contains more than one file, sections are labelled
`filename / sheet name` instead.
