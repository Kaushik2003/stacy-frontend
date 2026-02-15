export function Hero() {
    return (
        <>
            <div className="w-full h-[53vh]" aria-hidden="true" />

            {/* Absolute video background - moves with the parent container */}
            <video
                autoPlay
                muted
                loop
                playsInline
                className="absolute inset-0 w-full h-full object-cover pointer-events-none -z-10"
                style={{ objectPosition: "0% 25%" }}
            >
                <source src="/video.mp4" type="video/mp4" />
            </video>

            {/* Gradient overlay to blend video with page background */}
            <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-[#fbe1b1] via-[#fbe1b1]/60 to-transparent z-0 pointer-events-none" />
        </>
    );
}