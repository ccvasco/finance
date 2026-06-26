import yfinance as yf
import pandas as pd

# 1. Define your candidate list (Get this from Finviz/Yahoo Screener)
# These are examples: VZ (Verizon), T (AT&T), MO (Altria), O (Realty Income), KO (Coca-Cola)
candidates = ["VZ", "T", "MO", "O", "KO", "PFE", "XOM"]

results = []

print(f"Analyzing {len(candidates)} stocks...\n")

for symbol in candidates:
    try:
        stock = yf.Ticker(symbol)
        
        # Fetch fast info (contains price and dividends)
        # Note: .info might sometimes be slow or inconsistent, but it has 'trailingAnnualDividendYield'
        info = stock.info
        
        # Get Current Price
        current_price = info.get('currentPrice') or info.get('regularMarketPrice')
        
        # Get Annual Dividend Amount
        # Option A: Try direct yield from info (sometimes available)
        dividend_yield = info.get('trailingAnnualDividendYield')
        
        # Option B: Calculate manually if yield is missing (More robust)
        if dividend_yield is None and current_price and 'dividendRate' in info:
            annual_div = info['dividendRate']
            dividend_yield = (annual_div / current_price) if current_price > 0 else 0
            
        # Get P/E Ratio (Module B metric)
        pe_ratio = info.get('trailingPE')
        
        # Get Payout Ratio (Module C metric - Critical for safety)
        payout_ratio = info.get('payoutRatio') # Returns decimal (0.60 = 60%)

        if current_price and dividend_yield is not None:
            results.append({
                "Ticker": symbol,
                "Price": round(current_price, 2),
                "Dividend Yield (%)": round(dividend_yield * 100, 2),
                "P/E Ratio": round(pe_ratio, 2) if pe_ratio else "N/A",
                "Payout Ratio (%)": round(payout_ratio * 100, 2) if payout_ratio else "N/A",
                "Sector": info.get('sector', 'N/A')
            })
            
    except Exception as e:
        print(f"Error fetching {symbol}: {e}")

# 2. Create DataFrame and Sort by Yield (Highest first)
df = pd.DataFrame(results)

if not df.empty:
    df = df.sort_values(by="Dividend Yield (%)", ascending=False)
    
    print("-" * 80)
    print(f"{'Ticker':<6} {'Price':<10} {'Yield %':<12} {'P/E':<8} {'Payout %':<12} {'Sector':<20}")
    print("-" * 80)
    
    for _, row in df.iterrows():
        print(f"{row['Ticker']:<6} ${row['Price']:<9.2f} {row['Dividend Yield (%)']:<11.2f}% "
              f"{str(row['P/E']):<8} {str(row['Payout Ratio (%)']):<11.1f}% {row['Sector']:<20}")
    print("-" * 80)
    
    # Save to CSV for your records
    df.to_csv("output/high_dividend_candidates.csv", index=False)
    print("\nResults saved to 'output/high_dividend_candidates.csv'")
else:
    print("No data retrieved.")