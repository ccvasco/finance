import yfinance as yf


aapl = yf.Ticker("AAPL")

# Financials
# financials, quarterly_financials, balance_sheet, quarterly_balance_sheet, cashflow, quarterly_cashflow, earnings, quarterly_earnings Ticker methods 
bs = aapl.balance_sheet     # balance sheet
bs.to_csv("output/apple.balance_sheet.txt")
income_stmt = aapl.income_stmt
total_revenue = income_stmt.loc['Total Revenue']
print(total_revenue)

print(f"Current Ratio Analysis:")
# current_assets = bs.loc["Total Current Assets"].iloc[0] # Most recent year
# total_liabilities = bs.loc["Total Liabilities Net Minority Interest"].iloc[0] # Most recent total liabilities
# total_equity = bs.loc["Common Stock Equity"].iloc[0]

# # Wait, standard metric formulas:
# # Current Ratio = Current Assets / Current Liabilities
# current_liabilities = bs.loc["Total Current Liabilities"].iloc[0]
# current_ratio = current_assets / current_liabilities

# print(f"Current Assets: ${current_assets/1e9:.2f}B")
# print(f"Current Liab.: ${current_liabilities/1e9:.2f}B")
# print(f"-> Current Ratio: {current_ratio:.2f}")

# # Debt-to-Equity
# total_debt = bs.loc["Long Term Debt"].iloc[0] # Sometimes labeled differently depending on ticker
# if 'Long Term Debt' in bs.index:
#     total_debt = bs.loc['Long Term Debt'].iloc[0]
    
# d_e_ratio = total_debt / total_equity
# print(f"-> Debt-to-Equity: {d_e_ratio:.2f}")

fin = aapl.financials # Annual Income Statement
print("Revenue History (Last 5 Years):")
revenue_row = fin.loc["Total Revenue"]

for year, amount in revenue_row.items():
    print(f"{year}: ${amount/1e9:.2f}B")

# Calculate simple CAGR or YoY growth
# Example: Latest vs Previous
latest_rev = revenue_row.iloc[0]
prev_rev = revenue_row.iloc[1]
yoy_growth = (latest_rev - prev_rev) / prev_rev
print(f"\nYoY Revenue Growth: {yoy_growth:.2%}")