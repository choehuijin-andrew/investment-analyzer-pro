import yfinance as yf
import pandas as pd
import numpy as np
import requests
from bs4 import BeautifulSoup
import re
from typing import List, Dict, Any
import math

def clean_nans(obj):
    """Recursively replace NaNs/Inf/NaT with None for JSON safety."""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    elif isinstance(obj, dict):
        return {k: clean_nans(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_nans(v) for v in obj]
    elif pd.isna(obj): # Handles pd.NA, pd.NaT, np.nan
        return None
    elif hasattr(obj, 'item'): # Handle numpy scalars
        val = obj.item()
        if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
            return None
        return val
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
        t = tickers[0]
        # Some yfinance versions might return MultiIndex even for 1 ticker if forced? No.
        # But let's check columns.
        
        adj_col = 'Adj Close' if 'Adj Close' in data.columns else 'Close'
        
        # If data is empty
        if data.empty:
            return pd.DataFrame(), pd.DataFrame()
            
        try:
             df_tr = data[[adj_col]].rename(columns={adj_col: t})
             df_pr = data[['Close']].rename(columns={'Close': t})
             return df_tr.dropna(), df_pr.dropna()
        except:
             # Fallback if something weird with columns
             return pd.DataFrame(), pd.DataFrame()

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

from scipy.optimize import minimize

def get_portfolio_stats(weights, mean_returns, cov_matrix, rf=0.02):
    """Calculates return, volatility, and sharpe."""
    returns = np.sum(mean_returns * weights) * 252
    volatility = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights))) * np.sqrt(252)
    sharpe = (returns - rf) / volatility if volatility > 0 else 0
    return returns, volatility, sharpe

def optimize_portfolio(mean_returns, cov_matrix, target_return=None, goal='sharpe', rf=0.02):
    """
    Optimizes portfolio weights.
    Goals: 
      - 'sharpe': Maximize Sharpe Ratio
      - 'volatility': Minimize Volatility (optionally for a target return)
    """
    num_assets = len(mean_returns)
    args = (mean_returns, cov_matrix, rf)
    
    # Constraints
    constraints = [{'type': 'eq', 'fun': lambda x: np.sum(x) - 1}] # Weights sum to 1
    
    if goal == 'volatility' and target_return is not None:
        # Constraint: Return must be >= target
        constraints.append(
            {'type': 'eq', 'fun': lambda x: get_portfolio_stats(x, mean_returns, cov_matrix, rf)[0] - target_return}
        )

    constraints = tuple(constraints)

    # Bounds: 0 <= weight <= 1
    bounds = tuple((0.0, 1.0) for _ in range(num_assets))
    
    # Initial Guess: Equal weights
    init_guess = num_assets * [1. / num_assets,]
    
    if goal == 'sharpe':
        # Minimize Negative Sharpe
        def neg_sharpe(weights, mean_returns, cov_matrix, rf):
            return -get_portfolio_stats(weights, mean_returns, cov_matrix, rf)[2]
        
        result = minimize(neg_sharpe, init_guess, args=args, method='SLSQP', bounds=bounds, constraints=constraints)
        
    elif goal == 'volatility':
        # Minimize Volatility
        def portfolio_vol(weights, mean_returns, cov_matrix, rf):
            return get_portfolio_stats(weights, mean_returns, cov_matrix, rf)[1]
            
        result = minimize(portfolio_vol, init_guess, args=args, method='SLSQP', bounds=bounds, constraints=constraints)
        
    return result

def simulate_multi_asset_optimized(tickers: List[str], n_points=50):
    """
    Calculates the Efficient Frontier using SciPy optimization.
    Returns:
      - frontier: List of points on the curve
      - max_sharpe: The max sharpe portfolio
      - min_vol: The global minimum volatility portfolio
    """
    if len(tickers) < 2:
        return {}

    # 1. Fetch Data (10Y for better long-term correlation/diversification view)
    df = fetch_history_multiple(tickers, period="10y")
    if df.empty or len(df.columns) < 2:
        return {}

    # 2. Daily Returns & Stats
    daily_returns = df.pct_change().dropna()
    if daily_returns.empty:
        return {}
        
    mean_daily_returns = daily_returns.mean()
    cov_matrix = daily_returns.cov()
    valid_tickers = df.columns.tolist()
    
    current_rf = 0.035 # Assume 3.5% Risk Free Rate for Sharpe Calculation

    # 3. Find Extremes
    # Max Sharpe
    max_sharpe_res = optimize_portfolio(mean_daily_returns, cov_matrix, goal='sharpe', rf=current_rf)
    ms_ret, ms_vol, ms_sharpe = get_portfolio_stats(max_sharpe_res.x, mean_daily_returns, cov_matrix, rf=current_rf)
    max_sharpe_point = {
        "return": round(ms_ret, 4),
        "risk": round(ms_vol, 4),
        "sharpe": round(ms_sharpe, 4),
        "weights": {t: round(max_sharpe_res.x[i], 4) for i, t in enumerate(valid_tickers)}
    }

    # Min Volatility (Global)
    min_vol_res = optimize_portfolio(mean_daily_returns, cov_matrix, goal='volatility', rf=current_rf)
    mv_ret, mv_vol, mv_sharpe = get_portfolio_stats(min_vol_res.x, mean_daily_returns, cov_matrix, rf=current_rf)
    min_vol_point = {
        "return": round(mv_ret, 4),
        "risk": round(mv_vol, 4),
        "sharpe": round(mv_sharpe, 4),
        "weights": {t: round(min_vol_res.x[i], 4) for i, t in enumerate(valid_tickers)}
    }
    
    # 4. Generate Frontier Points
    # Use min(ms_ret, max_possible) to avoid plotting crazy high return points if max sharpe is super high leverage (not possible here due to constraints)
    # Frontier typically goes from Min Vol -> Max Sharpe -> Max Return
    
    max_possible_return = mean_daily_returns.max() * 252
    
    # We want the curve to look smooth. 
    # Range: Min Vol Return -> Max Return
    target_returns = np.linspace(mv_ret, max_possible_return, n_points)
    
    frontier_points = []
    
    for tr in target_returns:
        try:
            res = optimize_portfolio(mean_daily_returns, cov_matrix, target_return=tr, goal='volatility', rf=current_rf)
            if res.success:
                p_ret, p_vol, p_sharpe = get_portfolio_stats(res.x, mean_daily_returns, cov_matrix, rf=current_rf)
                frontier_points.append({
                    "return": round(p_ret, 4),
                    "risk": round(p_vol, 4),
                    "sharpe": round(p_sharpe, 4),
                    "weights": {t: round(res.x[i], 4) for i, t in enumerate(valid_tickers)}
                })
        except:
            pass
            
    # Include the special points in the frontier list if not close
    # Actually, returning them separately is better for UI highlighting.
    
    return {
        "frontier": frontier_points,
        "max_sharpe": max_sharpe_point,
        "min_vol": min_vol_point,
        # Legacy support: also return all points as a single list for simple scatter if needed
        "simulation": frontier_points # Backward compatibility key
    }

# Legacy wrapper if needed, or we can replace the old function entirely.
# The user wants enhancement, so replacing logic is fine.
def simulate_multi_asset_monte_carlo(tickers: List[str], n_simulations=2000):
   """Redirects to optimized version for better results."""
   return simulate_multi_asset_optimized(tickers)

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
        print(f"[DEBUG] Fetching details for {ticker}...")
        t = yf.Ticker(ticker)
        
        # Check info explicitly
        try:
             info = t.info
        except Exception as e:
             print(f"[WARN] t.info failed for {ticker}: {e}")
             info = {}
             
        if info is None: 
            print(f"[WARN] t.info is None for {ticker}")
            info = {}

        print(f"[DEBUG] Info keys: {list(info.keys())[:5]}")
        
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
        print("[DEBUG] Basic info constructed.")
        
        # 2. Dividend Growth
        try:
            print("[DEBUG] Fetching dividends...")
            divs = t.dividends
            growth = {
                "cagr_3y": 0,
                "cagr_5y": 0,
                "cagr_10y": 0,
                "years_growth": 0
            }
            
            # Defensive check: ensure divs is a Series/DataFrame and not empty
            if divs is not None and not divs.empty:
                print(f"[DEBUG] Divs found: {len(divs)}")
                growth["cagr_3y"] = round(calculate_growth_rate(divs, 3) * 100, 2)
                growth["cagr_5y"] = round(calculate_growth_rate(divs, 5) * 100, 2)
                growth["cagr_10y"] = round(calculate_growth_rate(divs, 10) * 100, 2)
                
                # Simple streak calc
                # Group by year
                annual = divs.groupby(divs.index.year).sum()
                if annual is not None and len(annual) > 1: # Check annual validity
                    streak = 0
                    vals = annual.values
                    for i in range(len(vals)-1, 0, -1):
                        if vals[i] >= vals[i-1]:
                            streak += 1
                        else:
                            break
                    growth["years_growth"] = streak
                
                details["dividend_growth"] = growth
                
                # Safe iteration for history
                # Check if annual is safe
                if annual is not None:
                    details["dividend_history"] = [{"year": y, "amount": round(v, 4)} for y, v in annual.items()]
                else:
                    details["dividend_history"] = []
            else:
                print("[DEBUG] Divs empty or None.")
                details["dividend_growth"] = growth
                details["dividend_history"] = []
                
        except Exception as e:
            print(f"[WARN] Div Error: {e}")
            import traceback
            traceback.print_exc()
            details["dividend_growth"] = growth
            details["dividend_history"] = []

        # 3. Financials (Stocks)
        print("[DEBUG] Fetching financials...")
        financials_data = []
        try:
            fin = t.financials
            # Check if fin is valid
            if fin is not None and not fin.empty:
                 print(f"[DEBUG] Financials shape: {fin.shape}")
                 dates = fin.columns
                 if dates is not None: # Ensure dates is iterable
                     for d in dates:
                         rev = 0
                         if fin.index is not None and 'Total Revenue' in fin.index:
                             rev = fin.loc['Total Revenue'][d]
                         
                         income = 0
                         if fin.index is not None and 'Net Income' in fin.index:
                             income = fin.loc['Net Income'][d]

                         financials_data.append({
                             "date": d.strftime("%Y-%m-%d"),
                             "revenue": rev,
                             "net_income": income
                         })
                     financials_data.sort(key=lambda x: x['date'])
            else:
                 print("[DEBUG] Financials empty or None.")
        except Exception as e:
             print(f"[WARN] Fin Error: {e}") 
             import traceback
             traceback.print_exc()
             pass
        details["financials"] = financials_data
        
        # 4. Sector Weightings (ETF Proxy for Holdings)
        # Often in 'sectorWeightings' or just return N/A
        details["sector_weights"] = [] # Placeholder, hard to get from basic yfinance without funds_data
        
        print("[DEBUG] Cleaning NaNs...")
        return clean_nans(details)
        
    except Exception as e:
        print(f"[ERROR] Detail Fetch CRASH {ticker}: {e}")
        import traceback
        traceback.print_exc()
        return None

def calculate_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    """Calculates Relative Strength Index (RSI)."""
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).fillna(0)
    loss = (-delta.where(delta < 0, 0)).fillna(0)
    
    avg_gain = gain.rolling(window=period, min_periods=period).mean()
    avg_loss = loss.rolling(window=period, min_periods=period).mean()
    
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

def calculate_mfi(high: pd.Series, low: pd.Series, close: pd.Series, volume: pd.Series, period: int = 14) -> pd.Series:
    """Calculates Money Flow Index (MFI)."""
    typical_price = (high + low + close) / 3
    raw_money_flow = typical_price * volume
    
    tp_diff = typical_price.diff()
    positive_flow = raw_money_flow.where(tp_diff > 0, 0)
    negative_flow = raw_money_flow.where(tp_diff < 0, 0)
    
    positive_mf = positive_flow.rolling(window=period, min_periods=period).sum()
    negative_mf = negative_flow.rolling(window=period, min_periods=period).sum()
    
    # Avoid division by zero
    mfi = 100 - (100 / (1 + (positive_mf / negative_mf)))
    mfi = mfi.fillna(50) # Neutral if undefined
    return mfi

def search_ticker(query: str):
    """
    Searches for tickers using Yahoo Finance Autocomplete API.
    Supports English and Korean queries.
    """
    # Detect Korean characters to optimize search params
    def has_korean(text):
        for char in text:
            if '\uac00' <= char <= '\ud7a3':
                return True
        return False

    is_korean = has_korean(query)
    
    # Primary Search (Customized for Language)
    # Note: 'region=KR' often causes 400 Errors. Using 'region=US' with 'lang=ko-KR' is safer 
    # and still finds Korean stocks (e.g., searches for '삼성' return '005930.KS').
    url = "https://query2.finance.yahoo.com/v1/finance/search"
    params = {
        "q": query,
        "quotesCount": 10,
        "newsCount": 0,
        "enableFuzzyQuery": "false",
        "enableXray": "true",
        "enableCtl": "true",
        "enableStxCategories": "true",
        "region": "US",  # Changed from KR to US to avoid 400 Bad Request
        "lang": "ko-KR" if is_korean else "en-US" 
    }
    
    # User-Agent is required for Yahoo API
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    def fetch_search(search_params):
        try:
             print(f"[DEBUG] Searching for: {search_params['q']} (Region: {search_params.get('region')})")
             response = requests.get(url, params=search_params, headers=headers, timeout=5)
             
             if response.status_code != 200:
                 print(f"[ERROR] Search API failed: {response.status_code}")
                 return None
                 
             data = response.json()
             if "quotes" not in data:
                 return []
                 
             results = []
             for quote in data["quotes"]:
                 if quote.get("quoteType") not in ["EQUITY", "ETF", "MUTUALFUND"]:
                     continue
                 
                 results.append({
                     "symbol": quote.get("symbol"),
                     "name": quote.get("shortname") or quote.get("longname"),
                     "exchDisp": quote.get("exchDisp"),
                     "typeDisp": quote.get("typeDisp"),
                     "exchange": quote.get("exchange")
                 })
             return results
        except Exception as e:
            print(f"[ERROR] Search Exception: {e}")
            return None

    # Attempt 1
    results = fetch_search(params)
    
    # Fallback attempt (If failed or empty, and query was Korean)
    # Retry with standard defaults if customized request failed
    if results is None and is_korean:
        print("[DEBUG] Retrying search with default US/English parameters...")
        fallback_params = params.copy()
        fallback_params["lang"] = "en-US"
        fallback_params["region"] = "US"
        results = fetch_search(fallback_params)
        
    return results or []

def calculate_bollinger_bands(series: pd.Series, period: int = 20, std_dev: int = 2):
    """Calculates Bollinger Bands (Middle, Upper, Lower)."""
    middle = series.rolling(window=period).mean()
    std = series.rolling(window=period).std()
    upper = middle + (std * std_dev)
    lower = middle - (std * std_dev)
    return middle, upper, lower

def get_technical_analysis(ticker: str, period="2y"):
    """
    Fetches history and calculates RSI, MFI, Bollinger Bands.
    Returns current signals and timeseries.
    period="2y" to ensure enough data for MAs/RSI.
    """
    try:
        # Need Open/High/Low/Close/Volume
        df = yf.download(ticker, period=period, interval="1d", progress=False, auto_adjust=False)
        
        # Flatten columns if multi-index (common in newer yfinance)
        if isinstance(df.columns, pd.MultiIndex):
            # If specifically ticker level
            try:
                # Iterate columns to check if Ticker is level 0
                if ticker in df.columns.levels[0]:
                    df = df.xs(ticker, axis=1, level=0, drop_level=True)
                # else: assume flat or just use what is there
            except:
                pass
                
        # Column Check (Case insensitive or adjusting)
        # yfinance columns: Open, High, Low, Close, Adj Close, Volume
        
        # Ensure we work with clean series
        if 'Close' not in df.columns: return None
        
        # Helper to ensure 1D Series
        def to_series(data):
            if isinstance(data, pd.DataFrame):
                return data.iloc[:, 0]
            return data

        close = to_series(df['Close'])
        high = to_series(df['High'])
        low = to_series(df['Low'])
        volume = to_series(df['Volume'])
        
        # If series is empty
        if close.empty: return None

        # 1. Calculate Indicators
        rsi = calculate_rsi(close)
        mfi = calculate_mfi(high, low, close, volume)
        bb_mid, bb_upper, bb_lower = calculate_bollinger_bands(close)
        
        # 2. Prepare Timeseries for Chart (Last 1 year is usually enough for display, but user wants '2y' context?)
        # Let's return last 252 days usually.
        
        result_df = pd.DataFrame({
            "date": df.index,
            "price": close,
            "rsi": rsi,
            "mfi": mfi,
            "bb_upper": bb_upper,
            "bb_lower": bb_lower,
            "bb_mid": bb_mid
        }).dropna() # Drop initial NaNs from rolling
        
        # 3. Current Signal State (Latest)
        if result_df.empty: return None
        
        latest = result_df.iloc[-1]
        
        signals = {
            "current_price": round(latest['price'], 2),
            "rsi": round(latest['rsi'], 2),
            "mfi": round(latest['mfi'], 2),
            "bb_lower": round(latest['bb_lower'], 2),
            "bb_upper": round(latest['bb_upper'], 2),
            "bb_position": round((latest['price'] - latest['bb_lower']) / (latest['bb_upper'] - latest['bb_lower']) * 100, 1), # % position in band
            "date": latest['date'].strftime("%Y-%m-%d")
        }
        
        # Format Timeseries
        timeseries = []
        for _, row in result_df.iterrows():
            timeseries.append({
                "date": row['date'].strftime("%Y-%m-%d"),
                "price": round(row['price'], 2),
                "rsi": round(row['rsi'], 2),
                "mfi": round(row['mfi'], 2),
                "bb_upper": round(row['bb_upper'], 2),
                "bb_lower": round(row['bb_lower'], 2),
                "bb_mid": round(row['bb_mid'], 2)
            })
            
        return {
            "summary": signals,
            "timeseries": timeseries
        }

    except Exception as e:
        print(f"Technical Analysis Error {ticker}: {e}")
        return None
