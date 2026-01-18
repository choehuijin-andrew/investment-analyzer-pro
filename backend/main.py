from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import pandas as pd
import yfinance as yf
import analysis
import os

app = FastAPI(title="Investment Analyzer API")

# CORS Setup (Allow Frontend)
origins = ["http://localhost:3000", os.getenv("FRONTEND_URL")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in origins if o], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    tickers: List[str]
    start_date: str = "2020-01-01"
    end_date: str = "2023-12-31"

class SimulationRequest(BaseModel):
    tickers: List[str] # Expect exactly 2
    start_date: str
    end_date: str

class OverlapRequest(BaseModel):
    tickers: List[str]

@app.post("/api/overlap")
def analyze_overlap(request: OverlapRequest):
    try:
        if len(request.tickers) < 2:
            raise HTTPException(status_code=400, detail="Select at least 2 ETFs")
            
        print(f"Analyzing overlap for {request.tickers}")
        holdings = analysis.get_etf_holdings(request.tickers)
        # Use Hybrid calculation (Scraper + Local)
        overlap = analysis.calculate_overlap_hybrid(holdings, request.tickers)
        
        return {"overlap": overlap, "holdings": holdings}
    except Exception as e:
        print(f"Overlap Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/advanced")
def analyze_advanced(request: AnalyzeRequest):
    try:
        print(f"Advanced Analysis for {request.tickers}")
        
        # Calculate start_date - 1 year for Rolling Window context
        start_dt = pd.to_datetime(request.start_date)
        adjusted_start = (start_dt - pd.Timedelta(days=366)).strftime("%Y-%m-%d")
        
        df_tr, _ = analysis.fetch_data(request.tickers, adjusted_start, request.end_date)
        
        if df_tr.empty:
            raise HTTPException(status_code=404, detail="No data.")

        # Calculate Rolling & Drawdown using the extended data
        # Rolling window is 252. The first 252 will be NaN, which corresponds to the 'extra' year we fetched.
        # So the result mostly aligns with the requested start date.
        rolling_1y = analysis.calculate_rolling_returns(df_tr, window=252)
        drawdowns = analysis.calculate_drawdown_series(df_tr)
        
        # Optional: Filter the result timeseries to match the requested window?
        # The frontend chart usually auto-scales X-axis, so showing 'more' data is often fine/better context.
        # But if user requested exactly 2024, seeing 2023 might be confusing?
        # The prompt says "I set 2024~2026, but it ignores it". 
        # Actually, showing exact window is cleaner. Let's filter the FINAL list.
        
        def filter_ts(ts):
            return [x for x in ts if x['date'] >= request.start_date]
            
        return {
            "rolling_1y": filter_ts(rolling_1y),
            "drawdowns": filter_ts(drawdowns)
        }
    except Exception as e:
        print(f"Advanced Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/simulate_multi")
def simulate_multi_endpoint(req: SimulationRequest):
    try:
        # Only using tickers from SimulationRequest
        print(f"Multi-asset simulation for {req.tickers}")
        result = analysis.simulate_multi_asset_monte_carlo(req.tickers)
        return {"simulation": result}
    except Exception as e:
        print(f"Multi-asset Simulation Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class PortfolioItem(BaseModel):
    ticker: str
    shares: float
    cost_basis: float = 0
    monthly_contribution: float = 0

class DividendRequest(BaseModel):
    tickers: List[str]

class ProjectionRequest(BaseModel):
    portfolio: List[PortfolioItem]

@app.post("/api/dividend_stats")
def get_dividend_stats(req: DividendRequest):
    try:
        stats = analysis.get_dividend_stats(req.tickers)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/project_income")
def project_income(req: ProjectionRequest):
    try:
        # Convert Pydantic models to dicts for analysis function
        portfolio_dicts = [item.dict() for item in req.portfolio]
        result = analysis.project_income(portfolio_dicts)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/simulate")
def simulate_allocation(request: SimulationRequest):
    try:
        if len(request.tickers) != 2:
            raise HTTPException(status_code=400, detail="Please select exactly 2 tickers.")
        
        if request.tickers[0] == request.tickers[1]:
             raise HTTPException(status_code=400, detail="Please select two different tickers.")
             
        print(f"Simulating for {request.tickers}")
        # Fetch just these 2 to ensure we have aligned data
        df_tr, _ = analysis.fetch_data(request.tickers, request.start_date, request.end_date)
        
        if df_tr.empty or df_tr.shape[1] < 2:
             raise HTTPException(status_code=404, detail="Insufficient data for simulation.")
             
        daily_returns = df_tr.pct_change().dropna()
        curve = analysis.calculate_allocation_curve(daily_returns)
        
        return {"curve": curve}
        
    except Exception as e:
        print(f"Simulation Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze")
def analyze_portfolio(request: AnalyzeRequest):
    try:
        # 1. Fetch Data
        print(f"Fetching data for {request.tickers} from {request.start_date} to {request.end_date}")
        df_tr, df_pr = analysis.fetch_data(request.tickers, request.start_date, request.end_date)
        
        if df_tr.empty:
            raise HTTPException(status_code=404, detail="No data found for the given tickers/dates.")
            
        # 2. Calculate Basic Metrics (Using TR for stats)
        # Check if TR and PR are identical (Debugging)
        if not df_pr.empty and df_tr.equals(df_pr):
            print("[WARNING] TR and PR DataFrames are identical! 'Adj Close' fetching might be failing.")
            
        metrics = analysis.calculate_metrics(df_tr, df_pr)
        
        # 3. Allocation Curve (Default to first 2)
        allocation_curve = []
        if len(metrics['stats'].keys()) >= 2:
            # Pass the daily returns of the *requested* tickers (or available ones)
            # metrics['stats'] keys are the compiled valid tickers
            valid_tickers = list(metrics['stats'].keys())
            if len(valid_tickers) >= 2:
                 # We need daily returns for the curve. calculate_metrics returns it?
                 # No, I removed it from return dict in previous helper but it returns distinct 'daily_returns' key.
                 # Let's use that.
                 curve_returns = metrics['daily_returns'][[valid_tickers[0], valid_tickers[1]]]
                 allocation_curve = analysis.calculate_allocation_curve(curve_returns)
            
        # Remove raw dataframe from response
        if 'daily_returns' in metrics:
            del metrics['daily_returns']
        
        return {
            "summary": metrics['stats'],
            "charts": {
                "trend_tr": metrics['timeseries_tr'],
                "trend_pr": metrics['timeseries_pr'],
                "correlation": metrics['correlation'],
                "allocation_curve": allocation_curve
            }
        }
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stock_details/{ticker}")
def get_stock_details_endpoint(ticker: str):
    try:
        details = analysis.get_stock_details(ticker)
        if not details:
            raise HTTPException(status_code=404, detail="Ticker not found or data unavailable")
        return details
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/history/{ticker}")
def get_price_history(ticker: str, period: str = "1y", interval: str = "1d"):
    """
    Fetches historical price data.
    """
    try:
        # yfinance download
        # period: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
        # interval: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
        
        # Validation mostly handled by yfinance, but let's be safe
        valid_periods = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "5y", "10y", "max"]
        if period not in valid_periods: period = "1y"
        
        df = yf.download(ticker, period=period, interval=interval, progress=False, auto_adjust=False)
        
        if df.empty:
            raise HTTPException(status_code=404, detail="No history found")
            
        # Format for Recharts: [{ date: '...', price: 100 }, ...]
        result = []
        
        # Single ticker download -> Columns are flat or MultiIndex?
        # If single ticker 'AAPL', columns are Open, High, Low, Close, Adj Close, Volume
        
        # Check columns
        if 'Adj Close' in df.columns:
            col = 'Adj Close'
        elif 'Close' in df.columns:
            col = 'Close'
        else:
            col = None
            
        if col:
            # Reindex to UTC to avoid timezone issues with serialization
            # df.index = df.index.tz_convert(None) # Sometimes required
            
            for date, row in df.iterrows():
                # Handling timezone
                try:
                    ts = date.strftime("%Y-%m-%d %H:%M") # Include time for intraday
                except:
                    ts = str(date)
                    
                val = row[col]
                # Handle Scalar (if single value, yfinance can be weird)
                if isinstance(val, pd.Series): val = val.iloc[0]
                
                if not pd.isna(val):
                    result.append({"date": ts, "price": round(float(val), 2)})
                    
        return result
        
    except Exception as e:
        print(f"History Error {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
