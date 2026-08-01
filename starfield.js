(() => {
  const starLayer = document.getElementById("stars");
  if (!starLayer) return;

  /*
   * Featured stars are deliberately kept away from the upper-left corner.
   * Their sizes are restrained so the Win98 window remains the focal point.
   */
  const featuredStars = [
    { x: 52, y: 18, colour: "cyan", size: "large", delay: 0.7, duration: 4.8 },
    { x: 92, y: 24, colour: "violet", size: "medium", delay: 1.4, duration: 5.3 },
    { x: 5, y: 47, colour: "blue", size: "medium", delay: 1.1, duration: 5.0 },
    { x: 97, y: 54, colour: "pink", size: "large", delay: 0.9, duration: 4.7 },
    { x: 16, y: 79, colour: "cyan", size: "medium", delay: 1.8, duration: 5.7 },
    { x: 34, y: 89, colour: "gold", size: "medium", delay: 0.5, duration: 4.9 },
    { x: 56, y: 77, colour: "violet", size: "large", delay: 1.2, duration: 5.2 },
    { x: 77, y: 85, colour: "mint", size: "medium", delay: 0.8, duration: 4.6 },
    { x: 92, y: 91, colour: "blue", size: "medium", delay: 1.7, duration: 5.4 }
  ];

  const palette = ["pink", "cyan", "violet", "gold", "mint", "blue"];
  const generatedStars = Array.from({ length: 26 }, (_, index) => {
    let x = (index * 43 + 13) % 98;
    let y = (index * 67 + 11) % 94;

    /* Prevent another accidental row of stars in the upper-left corner. */
    if (x < 38 && y < 22) y += 22;

    return {
      x,
      y,
      colour: palette[(index * 5 + 1) % palette.length],
      size: index % 10 === 0 ? "medium" : "small",
      delay: (index % 11) * 0.37,
      duration: 4.0 + (index % 6) * 0.55
    };
  });

  starLayer.replaceChildren();

  [...featuredStars, ...generatedStars].forEach((config) => {
    const star = document.createElement("span");
    const sizeClass = config.size === "small" ? "" : ` ${config.size}`;
    star.className = `star ${config.colour}${sizeClass}`;
    star.style.left = `${config.x}%`;
    star.style.top = `${config.y}%`;
    star.style.setProperty("--delay", `${config.delay}s`);
    star.style.setProperty("--duration", `${config.duration}s`);
    starLayer.appendChild(star);
  });
})();
