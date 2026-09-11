export interface SidebarButtonSpec {
  id: string;
  label: string;
  onClick: () => void;
}

export function renderSidebarButtons(container: HTMLElement, specs: SidebarButtonSpec[]): void {
  for (const spec of specs) {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.id = spec.id;
    btn.textContent = spec.label;
    btn.addEventListener('click', spec.onClick);
    container.appendChild(btn);
  }
}
