import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { UI_THEME } from './UITheme';
import { uiAutomationBridge } from '../../automation/UIAutomationBridge';
import type { Button } from '@babylonjs/gui/2D/controls/button';

import { createListRowCard, createOverlayPopup, createPanelSection, createPopupHeader, POPUP_COLORS } from './PopupUtils';
import { addDialogScrollBlock } from './DialogBlueprint';
import { addUniformButtons, createHorizontalRow, UI_SPACING } from './LayoutUtils';
import {
  estimateParForHole,
  summarizeHoleGameplay,
  type CourseHoleDefinition,
} from '../../core/hole-construction';

export interface CourseLayoutPanelCallbacks {
  onClose: () => void;
  onOpenHoleBuilder?: () => void;
  onOpenTerrainShaper?: () => void;
  onOpenAssetBuilder?: () => void;
}

export class CourseLayoutPanel {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: CourseLayoutPanelCallbacks;

  private overlay: Rectangle | null = null;
  private summaryText: TextBlock | null = null;
  private holeList: StackPanel | null = null;
  private mainCloseButton: Button | null = null;

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
      width: 620,
      height: 700,
      colors: POPUP_COLORS.blue,
      padding: 15,
    });

    this.overlay = overlay;

    createPopupHeader(stack, {
      title: 'COURSE LAYOUT',
      titleColor: UI_THEME.colors.text.info,
      width: 590,
      onClose: () => this.callbacks.onClose(),
      onCloseButtonCreated: (button) => {
        this.mainCloseButton = button;
        this.syncAutomationControls();
      },
    });
    this.createSummarySection(stack);
    this.createActionRow(stack);
    this.createHoleList(stack);
    this.createFooter(stack);
  }

  private createSummarySection(parent: StackPanel): void {
    const summaryContainer = createPanelSection(parent, {
      name: 'courseSummaryContainer',
      width: 590,
      height: 90,
      theme: 'blue',
      paddingTop: 6,
    });

    this.summaryText = new TextBlock('courseSummaryText');
    this.summaryText.text = 'No hole layout has been defined yet.';
    this.summaryText.color = UI_THEME.colors.text.secondary;
    this.summaryText.fontSize = UI_THEME.typography.scale.s12;
    this.summaryText.textWrapping = true;
    this.summaryText.lineSpacing = '3px';
    summaryContainer.addControl(this.summaryText);
  }

  private createHoleList(parent: StackPanel): void {
    const { content } = addDialogScrollBlock(parent, {
      id: 'courseHoleListContainer',
      width: 590,
      height: 505,
      theme: 'blue',
      paddingTop: 6,
      scroll: {
        name: 'courseHoleScroll',
        width: 580,
        height: 495,
        contentName: 'courseHoleList',
        contentWidth: '556px',
        options: {
          barSize: 10,
          barColor: UI_THEME.colors.border.info,
        },
      },
    });
    this.holeList = content;
  }

  private createActionRow(parent: StackPanel): void {
    const row = createHorizontalRow(parent, {
      name: 'courseLayoutActions',
      widthPx: 590,
      heightPx: 34,
    });
    row.paddingTop = '4px';
    addUniformButtons(row, {
      rowWidthPx: 590,
      rowHeightPx: 30,
      gapPx: UI_SPACING.sm,
      specs: [
        { id: 'courseLayoutTerrain', label: 'Open Terrain Shaper', onClick: () => this.callbacks.onOpenTerrainShaper?.() },
        { id: 'courseLayoutHoles', label: 'Open Hole Designer', onClick: () => this.callbacks.onOpenHoleBuilder?.() },
        { id: 'courseLayoutAssets', label: 'Open Asset Builder', onClick: () => this.callbacks.onOpenAssetBuilder?.() },
      ],
    });
  }

  private createFooter(parent: StackPanel): void {
    const footer = new TextBlock('courseLayoutFooter');
    footer.text = 'Use Terrain Shaper for land forms, Hole Designer for tees and pins, and Asset Builder for props, furniture, and course dressing.';
    footer.color = UI_THEME.colors.text.secondary;
    footer.fontSize = UI_THEME.typography.scale.s11;
    footer.height = '30px';
    footer.paddingTop = '6px';
    parent.addControl(footer);
  }

  private createHoleRow(hole: CourseHoleDefinition): Rectangle {
    const row = createListRowCard({
      name: `courseHole_${hole.holeNumber}`,
      width: 548,
      height: 102,
      background: hole.validationIssues.length > 0
        ? 'rgba(82, 46, 46, 0.75)'
        : 'rgba(36, 62, 46, 0.75)',
      borderColor: hole.validationIssues.length > 0 ? '#9f6666' : '#4b7d5f',
      cornerRadius: 5,
    });

    const stack = new StackPanel(`courseHoleStack_${hole.holeNumber}`);
    stack.width = '528px';
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
      empty.text = 'No hole definitions found on this course yet.\nOpen Course Designer and place tee boxes plus pin positions to build a playable route.';
      empty.color = UI_THEME.colors.text.secondary;
      empty.fontSize = UI_THEME.typography.scale.s13;
      empty.height = '60px';
      empty.textWrapping = true;
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
    this.syncAutomationControls();
  }

  public hide(): void {
    if (this.overlay) {
      this.overlay.isVisible = false;
    }
    this.syncAutomationControls();
  }

  public isVisible(): boolean {
    return this.overlay?.isVisible ?? false;
  }

  public dispose(): void {
    uiAutomationBridge.unregisterPrefix('panel.layout.');
    if (this.overlay) {
      this.advancedTexture.removeControl(this.overlay);
      this.overlay.dispose();
    }
  }

  private syncAutomationControls(): void {
    uiAutomationBridge.unregisterPrefix('panel.layout.');
    uiAutomationBridge.register({
      id: 'panel.layout.close',
      label: 'Close Course Layout Panel',
      role: 'button',
      getControl: () => this.mainCloseButton,
      isVisible: () => this.overlay?.isVisible ?? false,
      isEnabled: () => this.mainCloseButton?.isEnabled ?? false,
      onActivate: () => this.callbacks.onClose(),
    });
  }
}
