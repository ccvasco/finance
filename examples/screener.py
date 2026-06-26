import requests
import pandas as pd

API_KEY = "YOUR_FMP_API_KEY" # Get one at site.financialmodelingprep.com
url = f"https://financialmodelingprep.com/api/v3/stock_screener?marketCapGreaterThan=2000000000&dividendYieldGreaterThan=4&apikey={API_KEY}"

response = requests.get(url)
data = response.json()

if data:
    df = pd.DataFrame(data)
    # Sort by dividend yield descending
    df = df.sort_values(by='dividendYield', ascending=False)
    
    print(df[['symbol', 'name', 'price', 'dividendYield']].head(10))
else:
    print("No results or invalid API key.")