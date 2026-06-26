
import yfinance as yf


aapl = yf.Ticker("AAPL")

aapl.info["marketCap"]
aapl.info["volume"]                 # current volume
aapl.info["averageVolume"]          # average volume over the last 24 hours
aapl.info["averageVolume10days"]    # average volume over the last 10 days


# weekly highs and lows for all the historical data that exists
aapl_historical = aapl.history(period="max", interval="1wk")
aapl_historical
aapl_historical["High"]
aapl_historical["Low"]

# High
# Low
# dayHiWeekLowgh
# dayLow
# fiftyTwoWeekHigh
# fiftyTwo