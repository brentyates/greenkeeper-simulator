import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { InputText } from '@babylonjs/gui/2D/controls/inputText';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Button } from '@babylonjs/gui/2D/controls/button';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { createSelectableButton, POPUP_COLORS, setSelectableButtonState } from './PopupUtils';
import { renderDialog } from './DialogRenderer';
import { UI_THEME } from './UITheme';
import { buildFieldLabel, buildStandardPrimaryDangerFooter } from './schemas/DialogSchemaPresets';

import { SCENARIOS } from '../../data/scenarioData';
import { getCourseById } from '../../data/courseData';

export interface CourseSetupResult {
  name: string;
  width: number;
  height: number;
  templateCourseId?: string;
}

export interface CourseSetupDialogCallbacks {
  onCreate: (result: CourseSetupResult) => void;
  onCancel: () => void;
}

export class CourseSetupDialog {
  private overlay: Rectangle;
  private nameInput: InputText | null = null;
  private widthInput: InputText | null = null;
  private heightInput: InputText | null = null;
  private templateId = '';
  private templateButtons: Button[] = [];
  private sizePresetButtons: Button[] = [];
  private errorTextId = 'setupError';
  private textById: Map<string, import('@babylonjs/gui/2D/controls/textBlock').TextBlock>;
  private callbacks: CourseSetupDialogCallbacks;

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: CourseSetupDialogCallbacks) {
    this.callbacks = callbacks;

    const rendered = renderDialog(advancedTexture, {
      name: 'setup',
      shell: 'overlay',
      width: 470,
      height: 520,
      padding: 20,
      colors: POPUP_COLORS.green,
      title: 'CREATE A COURSE',
      titleColor: UI_THEME.colors.text.success,
      headerWidth: 426,
      onClose: () => this.callbacks.onCancel(),
      nodes: [
        { type: 'custom', id: 'planningHint', render: (parent) => this.renderPlanningHint(parent) },
        buildFieldLabel({ id: 'nameLabel', text: 'Course Name' }),
        { type: 'input', id: 'nameInput', text: 'My Course' },
        buildFieldLabel({ id: 'widthLabel', text: 'Width (20-200 tiles)' }),
        { type: 'input', id: 'widthInput', text: '50' },
        buildFieldLabel({ id: 'heightLabel', text: 'Height (20-200 tiles)' }),
        { type: 'input', id: 'heightInput', text: '50' },
        buildFieldLabel({ id: 'sizePresetLabel', text: 'Starter Sizes' }),
        { type: 'custom', id: 'sizePresets', render: (parent) => this.renderSizePresets(parent) },
        buildFieldLabel({ id: 'templateLabel', text: 'Template (optional)' }),
        { type: 'custom', id: 'templateSelector', render: (parent) => this.renderTemplateSelector(parent) },
        { type: 'text', id: this.errorTextId, text: '', color: UI_THEME.colors.text.danger, fontSize: UI_THEME.typography.captionSize, height: 20, align: Control.HORIZONTAL_ALIGNMENT_CENTER },
        { type: 'spacer', id: 'setupButtonSpacer', size: UI_THEME.spacing.sm },
        buildStandardPrimaryDangerFooter({
          id: 'setupButtons',
          rowWidth: 340,
          rowHeight: UI_THEME.sizing.actionButtonHeight,
          gap: 15,
          primary: { id: 'setupCreateBtn', label: 'START DESIGNING', onClick: () => this.handleCreate() },
          danger: { id: 'setupCancelBtn', label: 'BACK', onClick: () => this.callbacks.onCancel() },
        }),
      ],
    });

    this.overlay = rendered.overlay!;
    this.overlay.isVisible = true;
    this.textById = rendered.controls.texts;
    this.nameInput = rendered.controls.inputs.get('nameInput') ?? null;
    this.widthInput = rendered.controls.inputs.get('widthInput') ?? null;
    this.heightInput = rendered.controls.inputs.get('heightInput') ?? null;

    const buttonRow = rendered.controls.rows.get('setupButtons');
    if (buttonRow) {
      buttonRow.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    }
  }

  private renderPlanningHint(parent: StackPanel): void {
    const hintBox = new Rectangle('setupPlanningHint');
    hintBox.width = '426px';
    hintBox.height = '64px';
    hintBox.cornerRadius = UI_THEME.radii.section;
    hintBox.thickness = 1;
    hintBox.color = UI_THEME.colors.border.info;
    hintBox.background = UI_THEME.colors.surfaces.panelInset;
    parent.addControl(hintBox);

    const hintStack = new StackPanel('setupPlanningHintStack');
    hintStack.width = '398px';
    hintBox.addControl(hintStack);

    const title = new TextBlock('setupPlanningHintTitle');
    title.text = 'Start with a layout that matches your intent';
    title.color = UI_THEME.colors.text.info;
    title.fontSize = UI_THEME.typography.scale.s12;
    title.fontWeight = 'bold';
    title.height = '22px';
    title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    hintStack.addControl(title);

    const body = new TextBlock('setupPlanningHintBody');
    body.text = 'Smaller courses are faster to block out. Use a template when you want believable routing immediately.';
    body.color = UI_THEME.colors.text.secondary;
    body.fontSize = UI_THEME.typography.scale.s11;
    body.height = '34px';
    body.textWrapping = true;
    body.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    hintStack.addControl(body);
  }

  private renderSizePresets(parent: StackPanel): void {
    const row = new StackPanel('setupSizePresetRow');
    row.isVertical = false;
    row.width = '426px';
    row.height = '34px';
    row.spacing = UI_THEME.spacing.sm;
    row.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    parent.addControl(row);

    this.createSizePreset(row, 'Compact', 36, 36);
    this.createSizePreset(row, 'Standard', 50, 50);
    this.createSizePreset(row, 'Wide', 72, 54);
  }

  private renderTemplateSelector(parent: StackPanel): void {
    const row = new StackPanel('setupTemplateRow');
    row.isVertical = false;
    row.width = '426px';
    row.height = '34px';
    row.spacing = UI_THEME.spacing.sm;
    row.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    parent.addControl(row);

    const noneBtn = this.createTemplateOption(row, 'Blank', '');
    setSelectableButtonState(noneBtn, true);

    const uniqueCourses = new Set<string>();
    for (const scenario of SCENARIOS) {
      if (!uniqueCourses.has(scenario.courseId)) {
        uniqueCourses.add(scenario.courseId);
        const course = getCourseById(scenario.courseId);
        if (course) {
          this.createTemplateOption(row, course.name.substring(0, 12), scenario.courseId);
        }
      }
      if (uniqueCourses.size >= 3) break;
    }
  }

  private createTemplateOption(parent: StackPanel, label: string, courseId: string): Button {
    const btn = createSelectableButton({
      id: `setupTemplate_${courseId || 'blank'}`,
      label,
      width: 96,
      height: 28,
      fontSize: UI_THEME.typography.scale.s10,
      style: {
        selectedBackground: UI_THEME.colors.legacy.c_2a5a3a,
        selectedColor: UI_THEME.colors.text.primary,
        unselectedBackground: UI_THEME.colors.miscButton.neutralBase,
        unselectedColor: UI_THEME.colors.text.fieldLabel,
        hoverBackground: UI_THEME.colors.editor.buttonHover,
      },
      onClick: () => {
        this.templateId = courseId;
        this.templateButtons.forEach(button => setSelectableButtonState(button, button === btn));
      },
    });
    this.templateButtons.push(btn);
    parent.addControl(btn);
    return btn;
  }

  private createSizePreset(parent: StackPanel, label: string, width: number, height: number): void {
    const btn = createSelectableButton({
      id: `setupPreset_${label}`,
      label: `${label} ${width}x${height}`,
      width: 132,
      height: 28,
      fontSize: UI_THEME.typography.scale.s10,
      style: {
        selectedBackground: UI_THEME.colors.miscButton.customEdit,
        selectedColor: UI_THEME.colors.text.primary,
        unselectedBackground: UI_THEME.colors.miscButton.neutralBase,
        unselectedColor: UI_THEME.colors.text.fieldLabel,
        hoverBackground: UI_THEME.colors.editor.buttonHover,
      },
      onClick: () => {
        if (this.widthInput) this.widthInput.text = String(width);
        if (this.heightInput) this.heightInput.text = String(height);
        this.sizePresetButtons.forEach(button => setSelectableButtonState(button, button === btn));
      },
    });
    if ((width === 50 && height === 50) || this.sizePresetButtons.length === 0) {
      setSelectableButtonState(btn, width === 50 && height === 50);
    }
    this.sizePresetButtons.push(btn);
    parent.addControl(btn);
  }

  private handleCreate(): void {
    const name = this.nameInput?.text?.trim() || '';
    const width = parseInt(this.widthInput?.text || '50', 10);
    const height = parseInt(this.heightInput?.text || '50', 10);

    if (!name) {
      this.showError('Please enter a course name');
      return;
    }
    if (isNaN(width) || width < 20 || width > 200) {
      this.showError('Width must be between 20 and 200');
      return;
    }
    if (isNaN(height) || height < 20 || height > 200) {
      this.showError('Height must be between 20 and 200');
      return;
    }

    this.callbacks.onCreate({
      name,
      width,
      height,
      templateCourseId: this.templateId || undefined,
    });
  }

  private showError(msg: string): void {
    const text = this.textById.get(this.errorTextId);
    if (text) text.text = msg;
  }

  public dispose(): void {
    this.overlay.dispose();
  }
}
