import React from 'react';

export const LMPLOGIcon = ({ className = "w-10 h-10" }: { className?: string }) => {
    return (
        <img
            src="/icons/192x192.png"
            className={`${className} object-contain`}
            alt="LMPLOG Logo"
        />
    );
};
