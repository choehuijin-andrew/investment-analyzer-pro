import React from 'react';
import { Info } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChartInfoProps {
    title?: string;
    description: string;
}

const ChartInfo: React.FC<ChartInfoProps> = ({ title, description }) => {
    return (
        <TooltipProvider>
            <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                    <span className="cursor-help inline-flex items-center justify-center p-1 text-slate-400 hover:text-white transition-colors">
                        <Info size={14} />
                    </span>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-slate-900 border border-slate-700 text-slate-200 max-w-xs p-3">
                    {title && <h4 className="font-bold text-white mb-1 text-xs">{title}</h4>}
                    <p className="text-xs leading-relaxed">{description}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

export default ChartInfo;
