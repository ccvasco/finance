
import pandas as pd


# - group_by: group by column or ticker (‘column’/’ticker’, default is ‘column’)
# - threads: use threads for mass downloading? (True/False/Integer)
# - proxy: proxy URL if you want to use a proxy server for downloading the data (optional, default is None)

# data = yf.download("AMZN AAPL GOOG", start="2010-01-01", end="2026-06-22")
# data = yf.download("AMZN AAPL GOOG", start="2010-01-01", end="2026-06-22", group_by='tickers')
# data


tickers_list = ["aapl", "goog", "amzn", "BAC", "BA"] # example list
tickers_data= {} # empty dictionary


for ticker in tickers_list:
    ticker_object = yf.Ticker(ticker)

    #convert info() output from dictionary to dataframe
    temp = pd.DataFrame.from_dict(ticker_object.info, orient="index")
    temp.reset_index(inplace=True)
    temp.columns = ["Attribute", "Recent"]
    
    # add (ticker, dataframe) to main dictionary
    tickers_data[ticker] = temp

combined_data = pd.concat(tickers_data)
combined_data = combined_data.reset_index()
del combined_data["level_1"] # clean up unnecessary column
combined_data.columns = ["Ticker", "Attribute", "Recent"] # update column names
combined_data


## Comparing by attribute
employees = combined_data[combined_data["Attribute"]=="fullTimeEmployees"].reset_index()
del employees["index"] # clean up unnecessary column
employees_sorted = employees.sort_values('Recent',ascending=False)
employees_sorted