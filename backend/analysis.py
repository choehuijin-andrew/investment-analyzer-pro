import yfinance as yf
import pandas as pd
import numpy as np
import requests
from bs4 import BeautifulSoup
import re
from typing import List, Dict, Any
import math

def clean_nans(obj):
    """Recursively replace NaNs with None (which becomes null in JSON)."""
    if isinstance(obj, float):
        return None if math.isnan(obj) else obj
    if isinstance(obj, dict):
        return {k: clean_nans(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean_nans(v) for v in obj]
    return obj

def fetch_data(tickers: List[str], start_date: str, end_date: str):
    """
    Fetches both Adjusted Close (TR) and Close (PR).
    Returns a dict with 'tr' and 'pr' DataFrames.
    """
    # Standard download without grouping (Columns: Attribute -> Ticker)
    data = yf.download(tickers, start=start_date, end=end_date, progress=False, auto_adjust=False)
    
    # Handle Single Ticker Case (Columns are flat: Open, High...)
    if len(tickers) == 1:
        # Check if 'Adj Close' exists (auto_adjust=False ensures it usually)
        # But if auto_adjust=True (default in some versions), it returns only Close (which is adjusted)
        # We explicitly asked for False, so 'Adj Close' should be there.
        t = tickers[0]
        adj_col = 'Adj Close' if 'Adj Close' in data.columns else 'Close'
        
        df_tr = data[[adj_col]].rename(columns={adj_col: t})
        df_pr = data[['Close']].rename(columns={'Close': t})
        
        return df_tr.dropna(), df_pr.dropna()

    # Multi Ticker Case
    # Columns are MultiIndex: ('Adj Close', 'SPY'), ('Close', 'SPY')...
    # Or just ('Adj Close', 'SPY') ...
    
    try:
        # Check available top-level columns
        # yfinance 0.2+ returns (Price, Ticker) usually
        
        # Extract TR
        if 'Adj Close' in data.columns:
            df_tr = data['Adj Close']
        elif 'Close' in data.columns:
            # Fallback
            df_tr = data['Close']
        else:
            df_tr = pd.DataFrame()
            
        # Extract PR
        if 'Close' in data.columns:
            df_pr = data['Close']
        else:
            df_pr = pd.DataFrame()
            
        # Filter for requested tickers (columns might be more or fewer if some failed)
        # Also ensure we only keep columns that are in our requested list
        valid_tickers = [t for t in tickers if t in df_tr.columns]
        df_tr = df_tr[valid_tickers].dropna()
        
        valid_tickers_pr = [t for t in tickers if t in df_pr.columns]
        df_pr = df_pr[valid_tickers_pr].dropna()
        
        print(f"[DEBUG] Fetch Data - TR Shape: {df_tr.shape}, PR Shape: {df_pr.shape}")
        return df_tr, df_pr
        
    except Exception as e:
        print(f"[DEBUG] Fetch Data Error: {e}")
        import traceback
        traceback.print_exc()
        return pd.DataFrame(), pd.DataFrame()

def get_etf_holdings(tickers: List[str]):
    holdings = {}
    print(f"[DEBUG] Fetching holdings for: {tickers}")
    for t in tickers:
        try:
            ticker = yf.Ticker(t)
            # Try funds_data (newer yfinance)
            if hasattr(ticker, 'funds_data'):
                fd = ticker.funds_data
                if fd and hasattr(fd, 'top_holdings'):
                     h_df = fd.top_holdings
                     if hasattr(h_df, 'index'):
                         holdings_list = h_df.index.tolist()
                         holdings[t] = holdings_list
                         print(f"[DEBUG] {t} holdings found: {len(holdings_list)} (Top 5: {holdings_list[:5]})")
                     else:
                         print(f"[DEBUG] {t} funds_data.top_holdings has no index")
                         holdings[t] = []
                else:
                    print(f"[DEBUG] {t} funds_data.top_holdings is None")
                    holdings[t] = []
            else:
                 print(f"[DEBUG] {t} has no funds_data")
                 holdings[t] = []
                 
        except Exception as e:
            print(f"[ERROR] Error fetching holdings for {t}: {e}")
            holdings[t] = []
            
    return holdings

def calculate_overlap(holdings_data):
    # Calculate intersection between first 2 tickers for Venn
    # If more, just intersection of all? User asked for "selected ETFs (2+)".
    # Let's return pairwise or intersection of all.
    # For Venn of 3 is complex. Let's do intersection of "All Selected".
    
    if len(holdings_data) < 2:
        return {}
        
    sets = {k: set(v) for k, v in holdings_data.items() if v}
    if not sets:
        return {}
    
    # Common to all
    common = set.intersection(*sets.values())
    
    # Union of all
    total = set.union(*sets.values())
    
    return {
        "common_count": len(common),
        "total_count": len(total),
        "common_holdings": list(common),
        "details": {k: len(v) for k, v in sets.items()}
    }

def check_etfrc_overlap(t1, t2):
    """
    Scrapes etfrc.com for overlap summary.
    """
    url = "https://www.etfrc.com/funds/overlap.php"
    params = {"f1": t1, "f2": t2}
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    print(f"[DEBUG] Scraping ETFRC for {t1} vs {t2}...")
    try:
        response = requests.get(url, params=params, headers=headers, timeout=10)
        if response.status_code != 200:
            print(f"[DEBUG] ETFRC Scrape Failed: {response.status_code}")
            return None
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 1. Basic Overlap Stats
        feature_data = soup.find_all("div", class_="feature-data")
        result = {}
        
        if len(feature_data) >= 2:
            pct_text = feature_data[0].text.strip().replace('%', '')
            count_text = feature_data[1].text.strip()
            result['overlap_pct'] = float(pct_text)
            result['common_count'] = int(count_text)
        else:
            print("[DEBUG] ETFRC Scrape: Could not find feature-data")
            return None

        # 2. Sector Drift (Parse from Script)
        # var sectorDeltaData = { labels: [...], ... data: [...] }
        script_content = response.text
        # Regex to find labels
        labels_match = re.search(r'labels:\s*\[(.*?)\]', script_content, re.DOTALL)
        data_match = re.search(r'data:\s*\[(.*?)\]', script_content, re.DOTALL)
        
        if labels_match and data_match:
            try:
                # Clean up quotes and split
                raw_labels = labels_match.group(1)
                labels = [l.strip().strip('"').strip("'") for l in raw_labels.split(',') if l.strip()]
                
                # Clean up numbers
                raw_data = data_match.group(1)
                data_values = [float(v.strip()) for v in raw_data.split(',') if v.strip()]
                
                sector_drift = []
                for l, v in zip(labels, data_values):
                    sector_drift.append({"sector": l, "drift": v})
                
                result['sector_drift'] = sector_drift
                print(f"[DEBUG] Scraped {len(sector_drift)} sectors")
            except Exception as e:
                 print(f"[DEBUG] Error parsing sector script: {e}")
                 result['sector_drift'] = []
        else:
             print("[DEBUG] Could not find sector regex match")
             result['sector_drift'] = []
             
        # 3. Overlapping Holdings Table
        holdings_table = soup.find("table", id="OverlapTable")
        holdings_list = []
        if holdings_table:
            rows = holdings_table.find_all("tr")
            # Skip header row 0
            for row in rows[1:]:
                cols = row.find_all("td")
                if len(cols) >= 5:
                    # Index 1: Name, 2: Wt1, 3: Wt2, 4: Overlap
                    name = cols[1].text.strip()
                    wt1 = cols[2].text.strip()
                    wt2 = cols[3].text.strip()
                    overlap = cols[4].text.strip()
                    
                    holdings_list.append({
                        "ticker": name, # It's actually Company Name, not Ticker, but fine for display
                        "weight1": wt1,
                        "weight2": wt2,
                        "overlap_weight": overlap
                    })
        
        result['etfrc_holdings'] = holdings_list
        print(f"[DEBUG] Scraped {len(holdings_list)} detailed holdings")
        
        return result
        
    except Exception as e:
        print(f"[DEBUG] Error scraping etfrc: {e}")
        return None

def calculate_overlap_hybrid(holdings_data, tickers):
    # Base calculation using local data
    local_result = calculate_overlap(holdings_data)
    
    # ALWAYS try scraping for 2 tickers to get accurate Overlap % and Count
    # yfinance only gives Top 10, so local calculation is statistically meaningless for broad ETFs.
    if len(tickers) == 2:
        scraped = check_etfrc_overlap(tickers[0], tickers[1])
        if scraped:
            # Merge: Use Scraped Summary numbers, but keep Local Holdings list (Top 10) as a sample
            # This allows us to show "51% Overlap" (from source) AND "Top Common: AAPL, MSFT..." (from local)
            
            holdings_list = local_result.get("common_holdings", []) if local_result else []
            
            return {
                "common_count": scraped['common_count'],
                "total_count": 0, 
                "common_holdings": holdings_list, 
                "overlap_pct": scraped['overlap_pct'],
                "sector_drift": scraped.get('sector_drift', []),
                "detailed_holdings": scraped.get('etfrc_holdings', []),
                "source": "etfrc_scrape"
            }
            
    return local_result

def calculate_rolling_returns(df: pd.DataFrame, window: int = 252) -> List[Dict]:
    """
    Calculates Rolling 1-Year (252 days) Returns.
    """
    # Percentage change over 'window' periods
    # (Price_t / Price_{t-window}) - 1
    rolling = df.pct_change(periods=window).dropna() * 100
    return calculate_timeseries(rolling)

def calculate_drawdown_series(df: pd.DataFrame) -> List[Dict]:
    """
    Calculates Drawdown % from peak for each day.
    """
    roll_max = df.cummax()
    drawdown = (df / roll_max - 1) * 100
    return calculate_timeseries(drawdown)

def calculate_timeseries(df: pd.DataFrame) -> List[Dict]:
    """Helper to normalize and format timeseries"""
    if df.empty:
        print("[DEBUG] calculate_timeseries: DF is empty!")
        return []
        
    timeseries = []
    for date, row in df.iterrows():
        item = {"date": date.strftime("%Y-%m-%d")}
        for ticker, val in row.items():
            item[ticker] = round(val, 2)
        timeseries.append(item)
    return timeseries

def calculate_metrics(df_tr: pd.DataFrame, df_pr: pd.DataFrame) -> Dict[str, Any]:
    """
    Calculates CAGR, MDD, Volatility using TR data.
    Returns timeseries for both TR and PR.
    """
    # Financial metrics based on TR (Total Return)
    daily_returns = df_tr.pct_change().dropna()
    print(f"[DEBUG] Daily Returns Shape: {daily_returns.shape}")
    
    days = (df_tr.index[-1] - df_tr.index[0]).days
    total_return = (df_tr.iloc[-1] / df_tr.iloc[0])
    cagr = (total_return ** (365.25 / days)) - 1
    
    roll_max = df_tr.cummax()
    drawdown = (df_tr / roll_max) - 1.0
    mdd = drawdown.min()
    
    volatility = daily_returns.std() * np.sqrt(252)
    
    correlation_matrix = daily_returns.corr()
    
    # Stats Dict
    stats = {}
    for ticker in df_tr.columns:
        stats[ticker] = {
            "cagr": round(cagr.get(ticker, 0), 4),
            "mdd": round(mdd.get(ticker, 0), 4),
            "volatility": round(volatility.get(ticker, 0), 4)
        }
        
    # Heatmap Data
    corr_data = []
    for x in correlation_matrix.columns:
        for y in correlation_matrix.columns:
            corr_data.append({
                "x": x,
                "y": y,
                "value": round(correlation_matrix.loc[x, y], 3)
            })

    return {
        "stats": stats,
        "correlation": corr_data,
        "timeseries_tr": calculate_timeseries((df_tr / df_tr.iloc[0] - 1) * 100),
        "timeseries_pr": calculate_timeseries((df_pr / df_pr.iloc[0] - 1) * 100),
        "daily_returns": daily_returns
    }

def calculate_allocation_curve(daily_returns: pd.DataFrame) -> List[Dict]:
    """
    Calculates Risk/Return for 2 assets from 0:100 to 100:0 weights (10% steps).
    Uses the first 2 columns of the DataFrame.
    """
    print(f"[DEBUG] Calculating Allocation Curve. Columns: {daily_returns.columns}, Shape: {daily_returns.shape}")
    if daily_returns.shape[1] < 2:
        print("[DEBUG] Not enough assets for allocation curve.")
        return []
        
    t1, t2 = daily_returns.columns[:2]
    
    # Covariance for 2 assets
    # cov_matrix is 2x2
    sub_returns = daily_returns[[t1, t2]]
    cov = sub_returns.cov() * 252
    mean_ret = sub_returns.mean() * 252
    
    results = []
    
    # 0 to 10 inclusive, so 11 steps: 0, 10, ... 100
    for i in range(11):
        w1 = i / 10.0      # 0.0, 0.1, ... 1.0
        w2 = 1.0 - w1
        
        weights = np.array([w1, w2])
        
        # Risk
        var = np.dot(weights.T, np.dot(cov, weights))
        std = np.sqrt(var)
        
        # Return
        ret = np.sum(mean_ret * weights)
        
        # Label
        label = f"{int(w1*100)}:{int(w2*100)}"
        
        results.append({
            "label": label,
            "risk": round(std, 4),
            "return": round(ret, 4),
            "w1": round(w1, 2),
            "w2": round(w2, 2),
            "t1": t1,
            "t2": t2
        })
        
    return results

def fetch_history_multiple(tickers: List[str], period="5y") -> pd.DataFrame:
    """Fetches historical adjusted close prices for multiple tickers."""
    try:
        data = yf.download(tickers, period=period, progress=False, group_by='ticker', auto_adjust=False)
        
        # yf.download structure varies by version and grouping.
        # If group_by='ticker', columns are MultiIndex (Ticker, Attribute)
        # We need to extract Adj Close or Close for each ticker.
        
        price_data = {}
        for t in tickers:
            try:
                # Try to get data for this ticker
                if len(tickers) == 1:
                    # Flat structure if 1 ticker usually
                    ticker_df = data
                else:
                    ticker_df = data[t]
                    
                if 'Adj Close' in ticker_df:
                    price_data[t] = ticker_df['Adj Close']
                elif 'Close' in ticker_df:
                    price_data[t] = ticker_df['Close']
            except KeyError:
                continue
                
        df = pd.DataFrame(price_data)
        # Drop columns with all NaNs
        df = df.dropna(axis=1, how='all')
        return df
    except Exception as e:
        print(f"Error fetching history: {e}")
        return pd.DataFrame()

def simulate_multi_asset_monte_carlo(tickers: List[str], n_simulations=2000):
    """
    Runs a Monte Carlo simulation for a portfolio of tickers.
    Returns a list of {return, risk, sharpe, weights} objects.
    """
    if len(tickers) < 2:
        return []

    # 1. Fetch Data
    df = fetch_history_multiple(tickers)
    if df.empty or len(df.columns) < 2:
        return []

    # 2. Daily Returns & Covariance
    daily_returns = df.pct_change().dropna()
    if daily_returns.empty: 
        return []
        
    mean_daily_returns = daily_returns.mean()
    cov_matrix = daily_returns.cov()

    # Annualize
    # Expected Annual Return = Mean Daily * 252
    # Expected Annual Risk = sqrt(Daily Var * 252)
    
    results = []
    
    num_assets = len(df.columns)
    valid_tickers = df.columns.tolist()

    for _ in range(n_simulations):
        weights = np.random.random(num_assets)
        weights /= np.sum(weights)

        # Portfolio Return
        port_return = np.sum(weights * mean_daily_returns) * 252

        # Portfolio Volatility
        # var = w.T * Cov * w
        port_variance = np.dot(weights.T, np.dot(cov_matrix, weights))
        port_volatility = np.sqrt(port_variance) * np.sqrt(252)

        # Record
        weight_dict = {ticker: round(weight, 4) for ticker, weight in zip(valid_tickers, weights)}
        
        results.append({
            "return": round(port_return, 4),
            "risk": round(port_volatility, 4),
            "sharpe": round(port_return / port_volatility, 4) if port_volatility > 0 else 0,
            "weights": weight_dict
        })

    return results

def get_dividend_stats(tickers: List[str]):
    """
    Fetches dividend statistics: Yield, 5Y CAGR, Paying Years.
    Uses yfinance mostly.
    """
    stats = {}
    for t in tickers:
        try:
            ticker = yf.Ticker(t)
            # Fetch info
            info = ticker.info
            div_yield = info.get('dividendYield', 0)
            
            # Historical dividends
            divs = ticker.dividends
            cagr_5y = 0
            paying_years = 0
            
            if not divs.empty:
                # Calculate Paying Years (approx)
                paying_years = (divs.index[-1] - divs.index[0]).days / 365.25
                
                # Calculate 5Y CAGR (Very Rough)
                # Compare sum of dividends in last year vs 5 years ago
                # TODO: refine this with exact dates
                try:
                   latest_year = divs.groupby(divs.index.year).sum().iloc[-1]
                   five_years_ago = divs.groupby(divs.index.year).sum().iloc[-6] 
                   if five_years_ago > 0:
                       cagr_5y = ((latest_year / five_years_ago) ** (1/5)) - 1
                except:
                   pass

            stats[t] = {
                "yield": round(div_yield * 100, 2) if div_yield else 0,
                "cagr_5y": round(cagr_5y * 100, 2),
                "years_growth": int(paying_years),
                "frequency": "Quarterly" # Placeholder
            }
        except:
            stats[t] = {"yield": 0, "cagr_5y": 0, "years_growth": 0, "frequency": "N/A"}
            
    return stats

def get_dividend_calendar(tickers: List[str]):
    """
    Analyzes last 12 months of dividends to determine payout pattern and amounts.
    Returns: { ticker: { 'months': [1, 4, 7, 10], 'avg_amount': 0.5 } }
    """
    calendar = {}
    
    for t in tickers:
        try:
            ticker = yf.Ticker(t)
            # Fetch 2 years to be safe
            divs = ticker.dividends
            if divs.empty:
                calendar[t] = {'months': [], 'avg_amount': 0}
                continue
                
            # Filter last 12 months usually, but to be robust let's look at last 4 payments for Quarterly
            # or last 12 for Monthly.
            # Simplified: Look at last 365 days.
            last_date = divs.index[-1]
            one_year_ago = last_date - pd.Timedelta(days=365)
            
            recent_divs = divs[divs.index >= one_year_ago]
            
            if recent_divs.empty:
                 #Maybe it didn't pay in last year? Fallback to last known
                 recent_divs = divs.iloc[-4:] # Last 4 payments
            
            payout_months = recent_divs.index.month.tolist()
            avg_amount = recent_divs.mean()
            
            calendar[t] = {
                'months': payout_months,
                'avg_amount': avg_amount
            }
            print(f"[DEBUG] {t} Dividends: Months {payout_months}, Avg {avg_amount:.4f}")
            
        except Exception as e:
            print(f"Error fetching div calendar for {t}: {e}")
            calendar[t] = {'months': [], 'avg_amount': 0}
            
    return calendar

def project_income(portfolio: List[dict]):
    """
    Project future income based on portfolio.
    portfolio = [{ticker, shares, cost_basis, monthly_contribution}]
    Returns detailed monthly breakdown.
    """
    if not portfolio:
        return {"monthly_income": [], "yearly_income": [], "total_value": []}

    tickers = [p['ticker'] for p in portfolio]
    calendar = get_dividend_calendar(tickers)
    
    # 1. Monthly Income (Next 12 Months)
    # We want a list of 12 objects: { name: 'Jan', 'AAPL': 100, 'SCHD': 50, total: 150 }
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    monthly_data = []
    
    # Determine start month (e.g. next month) - simplified to Jan-Dec for fixed view or "Month 1-12"
    # User asked for "Month 1...12" in screenshot, let's Stick to Jan-Dec for better context?
    # Or strict "Month 1, Month 2" relative to now. 
    # Let's do generic Jan-Dec for now as it's cleaner to read. 
    
    current_shares = {p['ticker']: float(p['shares']) for p in portfolio}
    
    for month_idx in range(1, 13): # 1..12
        month_name = months[month_idx-1]
        row = {"name": month_name, "total": 0}
        
        for p in portfolio:
            t = p['ticker']
            cal = calendar.get(t)
            if cal and month_idx in cal['months']:
                qty = current_shares[t]
                amt = qty * cal['avg_amount']
                row[t] = round(amt, 2)
                row["total"] += amt
            else:
                row[t] = 0
                
        # Round total
        row["total"] = round(row["total"], 2)
        monthly_data.append(row)

    # 2. 10 Year Projection (Snowball)
    # Simplified Logic:
    # - Annual contributions are added
    # - Yield is reinvested
    # - Principal grows by CAGR (assume 7% cap gains + yield)
    
    # Calculate weighted yield and share counts
    total_val_start = sum([float(p['shares']) * 100 for p in portfolio]) # Mock price $100
    if total_val_start == 0: total_val_start = 1
    
    # Rough yield of portfolio
    # Sum of all dividends in last year / Total Value
    total_annual_div_start = sum ([
        calendar.get(p['ticker'], {}).get('avg_amount', 0) * len(calendar.get(p['ticker'], {}).get('months', [])) * float(p['shares'])
        for p in portfolio
    ])
    
    portfolio_yield = total_annual_div_start / total_val_start if total_val_start > 0 else 0
    growth_rate = 0.07 # 7% Cap Gains
    monthly_contrib = sum([float(p.get('monthly_buy', 0)) for p in portfolio])
    
    yearly_income = []
    snowball_value = []
    
    current_val = total_val_start
    # This loop is 'Year End' stats
    for year in range(1, 11):
        # Add contributions (simplified: at start of year)
        current_val += (monthly_contrib * 12)
        
        # Growth
        current_val *= (1 + growth_rate)
        
        # Income (Reinvested)
        # Assuming yield stays constant % (companies raise dividends to match price)
        current_year_income = current_val * portfolio_yield
        
        # Reinvest income
        current_val += current_year_income
        
        yearly_income.append(round(current_year_income, 2))
        snowball_value.append(round(current_val, 2))

    return {
        "monthly_income": monthly_data, # Detailed Breakdown
        "yearly_income": yearly_income,
        "total_value": snowball_value
    }

def calculate_growth_rate(series: pd.Series, years: int) -> float:
    """Calculates CAGR for a series over N years."""
    if len(series) < 2: return 0
    
    try:
        # Group by year sum to get annual values
        annual = series.groupby(series.index.year).sum()
        if len(annual) < years + 1: return 0 # Need at least N+1 years to calculate N year growth (Start vs End)
        
        # Use last full year vs N years ago
        # If current year is 2024, index might be 2024 (partial).
        # Safer: Use .iloc
        latest_val = annual.iloc[-2] if len(annual) > 1 else annual.iloc[-1]
        
        # If data is very short, fallback
        if len(annual) > years:
            past_val = annual.iloc[-(years + 1)] # N years ago
        else:
             past_val = annual.iloc[0] # Max available history

        if past_val <= 0 or latest_val <= 0: return 0
        
        # If less than requested years, adjust 'years' for calculation?
        # Let's simple it:
        return ((latest_val / past_val) ** (1/years)) - 1
    except Exception as e:
        # print(f"CAGR Calc Error: {e}")
        return 0

def get_stock_details(ticker: str):
    """
    Fetches detailed info for Dashboard.
    """
    try:
        t = yf.Ticker(ticker)
        info = t.info
        
        # 1. Basic Info
        details = {
            "name": info.get("shortName") or info.get("longName"),
            "price": info.get("currentPrice") or info.get("navPrice"),
            "currency": info.get("currency", "USD"),
            "change": 0, # Frontend needs to calc or fetch history
            "marketCap": info.get("marketCap", "N/A"),
            "pe": info.get("trailingPE", "N/A"),
            "forward_pe": info.get("forwardPE", "N/A"),
            "pbr": info.get("priceToBook", "N/A"),
            "roe": info.get("returnOnEquity", "N/A"),
            "div_yield": info.get("dividendYield", 0) * 100 if info.get("dividendYield") else 0,
            "sector": info.get("sector", "N/A"),
            "description": info.get("longBusinessSummary", ""),
            "beta": info.get("beta", "N/A"),
        }
        
        # 2. Dividend Growth
        divs = t.dividends
        growth = {
            "cagr_3y": 0,
            "cagr_5y": 0,
            "cagr_10y": 0,
            "years_growth": 0
        }
        
        if not divs.empty:
            growth["cagr_3y"] = round(calculate_growth_rate(divs, 3) * 100, 2)
            growth["cagr_5y"] = round(calculate_growth_rate(divs, 5) * 100, 2)
            growth["cagr_10y"] = round(calculate_growth_rate(divs, 10) * 100, 2)
            
            # Simple streak calc (consecutive years of increase)
            annual = divs.groupby(divs.index.year).sum()
            streak = 0
            if len(annual) > 1:
                vals = annual.values
                # Iterate backwards
                current_peak = vals[-1] 
                # Strict: must be strictly greater than prev. Or >=? usually >=.
                # Actually streak is defined as consecutive increases.
                for i in range(len(vals)-1, 0, -1):
                    if vals[i] >= vals[i-1]:
                        streak += 1
                    else:
                        break
            growth["years_growth"] = streak
            
        details["dividend_growth"] = growth
        details["dividend_history"] = [{"year": y, "amount": round(v, 4)} for y, v in divs.groupby(divs.index.year).sum().items()]
        
        # 3. Financials (Stocks)
        # Revenue/Net Income Trajectory
        financials_data = []
        try:
            fin = t.financials
            if not fin.empty:
                 # Columns are dates.
                 dates = fin.columns
                 for d in dates:
                     rev = fin.loc['Total Revenue'][d] if 'Total Revenue' in fin.index else 0
                     income = fin.loc['Net Income'][d] if 'Net Income' in fin.index else 0
                     financials_data.append({
                         "date": d.strftime("%Y-%m-%d"),
                         "revenue": rev,
                         "net_income": income
                     })
                 # Sort charts
                 financials_data.sort(key=lambda x: x['date'])
        except:
             pass
        details["financials"] = financials_data
        
        # 4. Sector Weightings (ETF Proxy for Holdings)
        # Often in 'sectorWeightings' or just return N/A
        details["sector_weights"] = [] # Placeholder, hard to get from basic yfinance without funds_data
        
        return clean_nans(details)
        
    except Exception as e:
        print(f"Detail Fetch Error {ticker}: {e}")
        return None
