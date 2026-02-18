'use client';

import { useState, useEffect } from 'react';

const SUBDOMAINS = [
  'vitalik',
  '💻',
  'deployer',
  'jesse',
  'clawdia',
  'starl3xx'
];

export default function TypewriterSubdomain() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const currentSubdomain = SUBDOMAINS[currentIndex];
    
    // Pause after fully typing
    if (!isDeleting && currentText === currentSubdomain) {
      setTimeout(() => {
        setIsPaused(false);
        setIsDeleting(true);
      }, 2000); // Pause for 2s at end
      return;
    }

    // Pause after fully deleting (except for first char)
    if (isDeleting && currentText === '') {
      setTimeout(() => {
        setIsPaused(false);
        setIsDeleting(false);
        setCurrentIndex((prev) => (prev + 1) % SUBDOMAINS.length);
      }, 500); // Short pause before next word
      return;
    }

    if (isPaused) return;

    const timeout = setTimeout(() => {
      if (isDeleting) {
        // Backspace
        setCurrentText(currentText.slice(0, -1));
      } else {
        // Type forward
        setCurrentText(currentSubdomain.slice(0, currentText.length + 1));
      }
    }, isDeleting ? 50 : 100); // Faster deletion, slower typing

    return () => clearTimeout(timeout);
  }, [currentText, isDeleting, currentIndex, isPaused]);

  return (
    <h1 className="text-6xl sm:text-7xl font-bold tracking-tight">
      <span className="inline-block min-w-[2ch]">
        {currentText}
        <span className="animate-pulse">|</span>
      </span>
      <span className="text-gray-500">.bankrclub</span>
      <span className="text-blue-400">.eth</span>
    </h1>
  );
}
