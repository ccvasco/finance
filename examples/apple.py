import yfinance as yf
import os

# Create Ticker object
aapl = yf.Ticker("AAPL")
aapl
# Download Apple stock data for the last year
# data = yf.download("AAPL", period="1y")
# print(data.head())   

# Create output folder if it doesn't exist
os.makedirs('output', exist_ok=True)
# aapl_historical = aapl.history(start="2010-01-01", end="2026-06-22", interval="1mo")
# aapl_historical = aapl.history(period="ytd", interval="1mo")
# aapl_historical.to_csv("output/AAPL_monthly_history.csv")
# print("Data saved to 'AAPL_monthly_history.csv'")

# - period: data period to download (either use period parameter or use start and end) Valid periods are:
# “1d”, “5d”, “1mo”, “3mo”, “6mo”, “1y”, “2y”, “5y”, “10y”, “ytd”, “max”
# - interval: data interval (1m data is only for available for last 7 days, and data interval <1d for the last 60 days) Valid intervals are:
# “1m”, “2m”, “5m”, “15m”, “30m”, “60m”, “90m”, “1h”, “1d”, “5d”, “1wk”, “1mo”, “3mo”
# - start: If not using period - in the format (yyyy-mm-dd) or datetime.
# - end: If not using period –-in the format (yyyy-mm-dd) or datetime.
# - prepost: Include Pre and Post regular market data in results? (Default is False)- no need usually to change this from False
# - auto_adjust: Adjust all OHLC (Open/High/Low/Close prices) automatically? (Default is True)- just leave this always as true and don’t worry about it
# - actions: Download stock dividends and stock splits events? (Default is True)

# Fetch different data types
# print(aapl.actions)        
# print(aapl.dividends)        
# print(aapl.splits)        
# print(aapl.info)          # Company metadata (PE ratio, market cap, etc.)
# print(aapl.history())     # Historical price data
# print(aapl.financials)    # Income statement
# print(aapl.dividends)     # Dividend history
# print(aapl.splits)        # Stock split history   


pe_ratio = aapl.info['forwardPE']       # P/E Ratio
dividend_rate = aapl.info['dividendRate']    # yearly dividend %
print(pe_ratio)
print(dividend_rate)
print(aapl.dividends)        # breakdown of each dividend payout as it occurred and on what date


