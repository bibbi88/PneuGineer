let cylinderCount = 0;

export function nextCylinderLetter(): string {
  const letter = String.fromCharCode(65 + (cylinderCount % 26));
  cylinderCount++;
  return letter;
}

export function resetCylinderLetters(): void {
  cylinderCount = 0;
}
