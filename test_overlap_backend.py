from backend.analysis import calculate_overlap_hybrid

def test_overlap():
    print("Testing overlap logic...")
    # Mock holdings data (empty as we rely on scraping for 2 tickers)
    holdings_data = {} 
    tickers = ["SPY", "QQQ"]
    
    print(f"Calling calculate_overlap_hybrid for {tickers}...")
    result = calculate_overlap_hybrid(holdings_data, tickers)
    
    print("Result:")
    import json
    print(json.dumps(result, indent=2, default=str))

if __name__ == "__main__":
    test_overlap()
