import axios from 'axios';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL + '/api' || 'http://localhost:8000/api', // FastAPI Backend URL
    headers: {
        'Content-Type': 'application/json',
    },
});

export const analyzeAdvanced = async (tickers: string[], startDate: string, endDate: string) => {
    const response = await api.post('/advanced', { tickers, start_date: startDate, end_date: endDate });
    return response.data;
};

export const checkOverlap = async (tickers: string[]) => {
    const response = await api.post('/overlap', { tickers });
    return response.data;
};

export const simulateAllocation = async (
    tickers: string[],
    startDate: string,
    endDate: string
) => {
    const response = await api.post('/simulate', {
        tickers,
        start_date: startDate,
        end_date: endDate,
    });
    return response.data;
};

export const simulateMultiAsset = async (tickers: string[], startDate: string = "2020-01-01", endDate: string = "2023-12-31") => {
    const response = await api.post('/simulate_multi', {
        tickers,
        start_date: startDate,
        end_date: endDate
    });
    return response.data;
};

export const analyzePortfolio = async (
    tickers: string[],
    startDate: string,
    endDate: string
) => {
    const response = await api.post('/analyze', {
        tickers,
        start_date: startDate,
        end_date: endDate,
    });
    return response.data;
};

export const getDividendStats = async (tickers: string[]) => {
    const response = await api.post('/dividend_stats', { tickers });
    return response.data;
};

export interface PortfolioItem {
    ticker: string;
    shares: number;
    cost_basis?: number;
    monthly_contribution?: number;
}

export const projectIncome = async (portfolio: PortfolioItem[]) => {
    const response = await api.post('/project_income', { portfolio });
    return response.data;
};

// ... (existing exports)

export const getStockDetails = async (ticker: string) => {
    const response = await api.get(`/stock_details/${ticker}`);
    return response.data;
};

export const getPriceHistory = async (ticker: string, period: string, interval: string) => {
    const response = await api.get(`/history/${ticker}?period=${period}&interval=${interval}`);
    return response.data;
};

export default api;
