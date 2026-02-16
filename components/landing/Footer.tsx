import React from "react";
import { Modak } from "next/font/google";

// Modak is a Google Font that closely mimics the heavy, chubby style of Blenny.
// Blenny is a paid font (Adobe), so Modak is the best free alternative.
const font = Modak({
    weight: "400",
    subsets: ["latin"],
});

export function Footer() {
    return (
        <footer className="text-[#E4E4E4] relative overflow-hidden flex flex-col justify-between h-[50vh] md:h-[60vh]">
            {/* Giant Background Text */}
            <div className="w-full h-full flex justify-center items-end pointer-events-none select-none leading-none pb-0">
                <h1 className={`${font.className} text-[24vw] md:text-[25vw] text-[#F2F0E9] leading-[0.75] mix-blend-normal tracking-wide uppercase`}>
                    Stacy
                </h1>
            </div>
        </footer>
    );
}
