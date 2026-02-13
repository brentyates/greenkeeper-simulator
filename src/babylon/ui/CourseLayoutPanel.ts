import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { UI_THEME } from './UITheme';

import { createListRowCard, createOverlayPopup, createPanelSection, createPopupHeader, POPUP_COLORS } from './PopupUtils';
import { addDialogScrollBlock } from './DialogBlueprint';
import {
  estimateParForHole,
  summarizeHoleGameplay,
  type CourseHoleDefinition,
} from '../../core/hole-construction';

export interface CourseLayoutPanelCallbacks {
  onClose: () => void;
}

export class CourseLayoutPanel {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: CourseLayoutPanelCallbacks;

  private overlay: Rectangle | null = null;
  private summaryText: TextBlock | null = null;
  private holeList: StackPanel | null = null;

  constructor(
    advancedTexture: AdvancedDynamicTexture,
    callbacks: CourseLayoutPanelCallbacks
  ) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPanel();
  }

  private createPanel(): void {
    const { overlay, stack } = createOverlayPopup(this.advancedTexture, {
      name: 'courseLayout',
      width: 560,
      height: 650,
      colors: POPUP_COLORS.blue,
      padding: 15,
    });

    this.overlay = overlay;

    createPopupHeader(stack, {
      title: 'COURSE LAYOUT',
      titleColor: '#88ccff',
      width: 530,
      onClose: () => this.callbacks.onClose(),
    });
    this.createSummarySection(stack);
    this.createHoleList(stack);
    this.createFooter(stack);
  }

  private createSummarySection(parent: StackPanel): void {
    const summaryContainer = createPanelSection(parent, {
      name: 'courseSummaryContainer',
      width: 530,
      height: 78,
      theme: 'blue',
      paddingTop: 6,
    });

    this.summaryText = new TextBlock('courseSummaryText');
    this.summaryText.text = 'No hole layout has been defined yet.';
    this.summaryText.color = UI_THEME.colors.legacy.c_aaaaaa;
    this.summaryText.fontSize = UI_THEME.typography.scale.s12;
    this.summaryText.textWrapping = true;
    summaryContainer.addControl(this.summaryText);
  }

  private createHoleList(parent: StackPanel): void {
    const { content } = addDialogScrollBlock(parent, {
      id: 'courseHoleListContainer',
      width: 530,
      height: 475,
      theme: 'blue',
      paddingTop: 6,
      scroll: {
        name: 'courseHoleScroll',
        width: 520,
        height: 465,
        contentName: 'courseHoleList',
        contentWidth: '500px',
        options: {
          barSize: 10,
          barColor: '#4a6f90',
        },
      },
    });
    this.holeList = content;
  }

  private createFooter(parent: StackPanel): void {
    const footer = new TextBlock('courseLayoutFooter');
    footer.text = 'Use Course Designer to place tee boxes and pins for each hole.';
    footer.color = UI_THEME.colors.legacy.c_7f99ad;
    footer.fontSize = UI_THEME.typography.scale.s11;
    footer.height = '28px';
    footer.paddingTop = '6px';
    parent.addControl(footer);
  }

  private createHoleRow(hole: CourseHoleDefinition): Rectangle {
    const row = createListRowCard({
      name: `courseHole_${hole.holeNumber}`,
      width: 492,
      height: 94,
      background: hole.validationIssues.length > 0
        ? 'rgba(82, 46, 46, 0.75)'
        : 'rgba(36, 62, 46, 0.75)',
      borderColor: hole.validationIssues.length > 0 ? '#9f6666' : '#4b7d5f',
      cornerRadius: 5,
    });

    const stack = new StackPanel(`courseHoleStack_${hole.holeNumber}`);
    stack.width = '474px';
    stack.paddingTop = '5px';
    stack.paddingLeft = '8px';
    row.addControl(stack);

    const yardages = Object.values(hole.yardages);
    const longest = yardages.length > 0 ? Math.max(...yardages) : null;
    const shortest = yardages.length > 0 ? Math.min(...yardages) : null;

    const title = new TextBlock(`courseHoleHeading_${hole.holeNumber}`);
    const estimatedPar = estimateParForHole(hole);
    title.text =
      longest !== null && shortest !== null
        ? `Hole ${hole.holeNumber}  |  Par ${estimatedPar}  |  ${Math.round(shortest)}-${Math.round(longest)} yds`
        : `Hole ${hole.holeNumber}  |  Par ${estimatedPar}`;
    title.color = UI_THEME.colors.legacy.c_ffffff;
    title.fontSize = UI_THEME.typography.scale.s14;
    title.fontWeight = 'bold';
    title.height = '22px';
    title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(title);

    const detail = new TextBlock(`courseHoleDetail_${hole.holeNumber}`);
    detail.text = `Tee sets: ${hole.teeBoxes.length}  |  Pins: ${hole.pinPositions.length}`;
    detail.color = UI_THEME.colors.legacy.c_b9c7d1;
    detail.fontSize = UI_THEME.typography.scale.s11;
    detail.height = '18px';
    detail.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(detail);

    const issues = new TextBlock(`courseHoleIssues_${hole.holeNumber}`);
    if (hole.validationIssues.length > 0) {
      issues.text = `Needs work: ${hole.validationIssues.join('; ')}`;
      issues.color = UI_THEME.colors.legacy.c_ffb4b4;
    } else {
      issues.text = 'Playable: tee boxes and pin positions are set.';
      issues.color = UI_THEME.colors.legacy.c_9fe0a9;
    }
    issues.fontSize = UI_THEME.typography.scale.s10;
    issues.height = '42px';
    issues.textWrapping = true;
    issues.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(issues);

    return row;
  }

  public update(holes: CourseHoleDefinition[]): void {
    const sorted = [...holes].sort((a, b) => a.holeNumber - b.holeNumber);
    const summary = summarizeHoleGameplay(sorted);

    if (this.summaryText) {
      this.summaryText.text =
        `Holes: ${summary.totalHoles} (${summary.playableHoles} playable)\n` +
        `Tee boxes: ${summary.totalTeeBoxes}  |  Pin positions: ${summary.totalPinPositions}\n` +
        `Course par: ${summary.coursePar}`;
    }

    if (!this.holeList) return;
    const children = [...this.holeList.children];
    for (const child of children) {
      this.holeList.removeControl(child);
    }

    if (sorted.length === 0) {
      const empty = new TextBlock('courseHoleEmpty');
      empty.text = 'No hole definitions found on this course yet.';
      empty.color = UI_THEME.colors.legacy.c_8f9dab;
      empty.fontSize = UI_THEME.typography.scale.s13;
      empty.height = '34px';
      this.holeList.addControl(empty);
      return;
    }

    for (const hole of sorted) {
      this.holeList.addControl(this.createHoleRow(hole));
    }
  }

  public show(): void {
    if (this.overlay) {
      this.overlay.isVisible = true;
    }
  }

  public hide(): void {
    if (this.overlay) {
      this.overlay.isVisible = false;
    }
  }

  public isVisible(): boolean {
    return this.overlay?.isVisible ?? false;
  }

  public dispose(): void {
    if (this.overlay) {
      this.advancedTexture.removeControl(this.overlay);
      this.overlay.dispose();
    }
  }
}
