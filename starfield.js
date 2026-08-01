(() => {
  const starLayer = document.getElementById("stars");
  if (!starLayer) return;

  /* Restore the full featured-star layout from the colourful version. */
  const featuredStars = [
    { x: 11, y: 11, colour: "pink", size: "large", delay: 0.2, duration: 4.8 },
    { x: 29, y: 8, colour: "gold", size: "medium", delay: 1.1, duration: 5.6 },
    { x: 51, y: 14, colour: "cyan", size: "large", delay: 0.7, duration: 4.4 },
    { x: 73, y: 10, colour: "violet", size: "medium", delay: 1.7, duration: 5.2 },
    { x: 92, y: 23, colour: "mint", size: "large", delay: 0.4, duration: 4.9 },
    { x: 4, y: 46, colour: "blue", size: "large", delay: 1.4, duration: 5.4 },
    { x: 97, y: 53, colour: "pink", size: "large", delay: 0.8, duration: 4.6 },
    { x: 14, y: 78, colour: "cyan", size: "medium", delay: 2.0, duration: 5.8 },
    { x: 33, y: 89, colour: "gold", size: "large", delay: 0.5, duration: 4.7 },
    { x: 55, y: 76, colour: "violet", size: "large", delay: 1.2, duration: 5.1 },
    { x: 76, y: 84, colour: "mint", size: "large", delay: 0.9, duration: 4.5 },
    { x: 91, y: 91, colour: "blue", size: "medium", delay: 1.8, duration: 5.5 }
  ];

  const palette = ["pink", "cyan", "violet", "gold", "mint", "blue"];
  const removedUpperLeftRow = new Set([0, 7, 14, 21, 28]);

  /*
   * Restore the original 34 generated coordinates, excluding only the five
   * medium stars that formed the diagonal row in the upper-left corner.
   */
  const generatedStars = Array.from({ length: 34 }, (_, index) => ({
    index,
    x: (index * 43 + 7) % 98,
    y: (index * 67 + 5) % 94,
    colour: palette[(index * 5 + 1) % palette.length],
    size: index % 7 === 0 ? "medium" : "small",
    delay: (index % 11) * 0.37,
    duration: 3.8 + (index % 6) * 0.55
  })).filter(({ index }) => !removedUpperLeftRow.has(index));

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
