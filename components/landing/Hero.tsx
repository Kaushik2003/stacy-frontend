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

            {/* Absolute dark gradient overlay */}
            {/* <div
                className="absolute inset-0 bg-gradient-to-b"
                aria-hidden="true"
            /> */}
        </>
    );
}