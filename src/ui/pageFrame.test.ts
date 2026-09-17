import { beforeEach, describe, expect, it } from 'vitest';
import { appState } from '../app/AppState';
import { initPageFrame, renderPageFrame, setPageFrameSize } from './pageFrame';
import { createSource } from '../components/source';
import type { ProjectBarRefs } from './projectBar';

function compLayer(): HTMLElement {
  return document.createElement('div');
}

function svgLayer(): SVGSVGElement {
  return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
}

function fakeProjectBar(name: string): ProjectBarRefs {
  return { getName: () => name, setName: () => {} };
}

describe('page frame', () => {
  beforeEach(() => {
    appState.components = [];
    appState.pageFrameSize = 'none';
    appState.pageFrameX = 0;
    appState.pageFrameY = 0;
    appState.projectAuthor = '';
    appState.projectCheckedBy = '';
    appState.projectCompany = '';
  });

  it('draws nothing while the size is "none"', () => {
    const layer = svgLayer();
    initPageFrame(layer, fakeProjectBar('test'));
    expect(layer.children.length).toBe(0);
  });

  it('draws a sheet rect and title block once a size is picked', () => {
    const layer = svgLayer();
    initPageFrame(layer, fakeProjectBar('test'));

    setPageFrameSize('a4');

    expect(layer.querySelector('.pageFrameRect')).not.toBeNull();
    expect(layer.querySelector('.pageFrameTitleBlock')).not.toBeNull();
  });

  it('title block shows the project name and the other title-block fields', () => {
    const layer = svgLayer();
    initPageFrame(layer, fakeProjectBar('Acme circuit'));
    appState.projectAuthor = 'Jane';
    appState.projectCheckedBy = 'Alex';
    appState.projectCompany = 'Acme Pneumatics';

    setPageFrameSize('a3');

    const values = Array.from(layer.querySelectorAll('.pageFrameTitleValue')).map(
      (el) => el.textContent,
    );
    expect(values).toEqual(['Acme circuit', 'Acme Pneumatics', 'Jane', 'Alex']);
  });

  it('centers on the current diagram when picked, and stays put afterward', () => {
    const layer = svgLayer();
    initPageFrame(layer, fakeProjectBar('test'));

    const comp = createSource(compLayer(), 400, 300);
    appState.addComponent(comp);
    const b = comp.getBounds();
    const expectedCx = b.x + b.w / 2;
    const expectedCy = b.y + b.h / 2;

    setPageFrameSize('a4');
    expect(appState.pageFrameX).toBeCloseTo(expectedCx);
    expect(appState.pageFrameY).toBeCloseTo(expectedCy);

    // Moving the component afterward must not drag an already-placed frame along with it - only
    // picking a size (again) recenters it.
    comp.setPos(4000, 4000);
    renderPageFrame();
    expect(appState.pageFrameX).toBeCloseTo(expectedCx);
    expect(appState.pageFrameY).toBeCloseTo(expectedCy);
  });

  it('switching between A4 and A3 re-centers on the diagram again, not the old frame center', () => {
    const layer = svgLayer();
    initPageFrame(layer, fakeProjectBar('test'));

    const comp = createSource(compLayer(), 0, 0);
    appState.addComponent(comp);
    setPageFrameSize('a4');
    const firstX = appState.pageFrameX;

    comp.setPos(9000, 9000);
    setPageFrameSize('a3');
    expect(appState.pageFrameX).not.toBeCloseTo(firstX);
  });
});
