"use strict";

const GameFrame = (() => {
  const frame = document.querySelector(".game-frame");
  if (!frame) throw new Error("GameFrame: .game-frame introuvable.");
  const content = frame.querySelector(".game-frame-content");
  if (!content) throw new Error("GameFrame: .game-frame-content introuvable.");

  function resize() {
    const frameWidth = frame.offsetWidth;
    const frameHeight = frame.offsetHeight;
    const scale = Math.min(1, window.innerWidth / frameWidth, window.innerHeight / frameHeight);
    const contentScale = Math.min(frame.clientWidth / content.offsetWidth, frame.clientHeight / content.offsetHeight);
    frame.style.setProperty("--game-frame-scale", String(scale));
    frame.classList.toggle("is-scaled", scale < 1);
    frame.style.left = `${(window.innerWidth - frame.offsetWidth * scale) / 2}px`;
    frame.style.top = `${(window.innerHeight - frame.offsetHeight * scale) / 2}px`;
    content.style.setProperty("--game-frame-content-scale", String(contentScale));
    content.style.left = `${(frame.clientWidth - content.offsetWidth * contentScale) / 2}px`;
    content.style.top = `${(frame.clientHeight - content.offsetHeight * contentScale) / 2}px`;
  }

  function mount(element) {
    frame.appendChild(element);
    return element;
  }

  resize();
  window.addEventListener("resize", resize);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);

  return { frame, mount };
})();
