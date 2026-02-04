import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { InputText } from '@babylonjs/gui/2D/controls/inputText';
import { Control } from '@babylonjs/gui/2D/controls/control';

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
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: CourseSetupDialogCallbacks;
  private overlay: Rectangle;
  private nameInput: InputText | null = null;
  private widthInput: InputText | null = null;
  private heightInput: InputText | null = null;
  private errorText: TextBlock | null = null;
  private templateId: string = '';

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: CourseSetupDialogCallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;

    this.overlay = new Rectangle('setupOverlay');
    this.overlay.width = '100%';
    this.overlay.height = '100%';
    this.overlay.background = 'rgba(0, 0, 0, 0.7)';
    this.overlay.thickness = 0;
    this.overlay.isPointerBlocker = true;

    this.buildUI();
    this.advancedTexture.addControl(this.overlay);
  }

  private buildUI(): void {
    const dialog = new Rectangle('setupDialog');
    dialog.width = '380px';
    dialog.height = '420px';
    dialog.cornerRadius = 12;
    dialog.background = '#1a3a2a';
    dialog.color = '#4a8a5a';
    dialog.thickness = 2;
    this.overlay.addControl(dialog);

    const stack = new StackPanel();
    stack.paddingTop = '20px';
    stack.paddingLeft = '20px';
    stack.paddingRight = '20px';
    dialog.addControl(stack);

    const title = new TextBlock();
    title.text = 'NEW COURSE';
    title.color = '#7FFF7F';
    title.fontSize = 20;
    title.fontFamily = 'Arial Black, sans-serif';
    title.height = '35px';
    stack.addControl(title);

    this.addFieldLabel(stack, 'Course Name');
    this.nameInput = this.addTextInput(stack, 'My Course');

    this.addFieldLabel(stack, 'Width (20-200 tiles)');
    this.widthInput = this.addTextInput(stack, '50');

    this.addFieldLabel(stack, 'Height (20-200 tiles)');
    this.heightInput = this.addTextInput(stack, '50');

    this.addFieldLabel(stack, 'Template (optional)');
    this.buildTemplateSelector(stack);

    this.errorText = new TextBlock('errorText');
    this.errorText.text = '';
    this.errorText.color = '#ff6666';
    this.errorText.fontSize = 11;
    this.errorText.fontFamily = 'Arial, sans-serif';
    this.errorText.height = '20px';
    this.errorText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    stack.addControl(this.errorText);

    const buttonRow = new StackPanel();
    buttonRow.isVertical = false;
    buttonRow.height = '45px';
    buttonRow.paddingTop = '10px';
    buttonRow.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    stack.addControl(buttonRow);

    this.addButton(buttonRow, 'Create', '#2a5a3a', () => this.handleCreate());
    this.addSpacer(buttonRow, '15px');
    this.addButton(buttonRow, 'Cancel', '#4a3a3a', () => this.callbacks.onCancel());
  }

  private addFieldLabel(parent: StackPanel, text: string): void {
    const label = new TextBlock();
    label.text = text;
    label.color = '#aaccaa';
    label.fontSize = 11;
    label.fontFamily = 'Arial, sans-serif';
    label.height = '20px';
    label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    label.paddingTop = '8px';
    parent.addControl(label);
  }

  private addTextInput(parent: StackPanel, placeholder: string): InputText {
    const input = new InputText();
    input.width = '100%';
    input.height = '30px';
    input.text = placeholder;
    input.color = 'white';
    input.fontSize = 12;
    input.fontFamily = 'Arial, sans-serif';
    input.background = '#0d1f15';
    input.focusedBackground = '#1a2a20';
    input.thickness = 1;
    input.focusedColor = '#7FFF7F';
    input.paddingLeft = '8px';
    parent.addControl(input);
    return input;
  }

  private buildTemplateSelector(parent: StackPanel): void {
    const row = new StackPanel();
    row.isVertical = false;
    row.height = '28px';
    parent.addControl(row);

    const noneBtn = this.createTemplateOption(row, 'Blank', '');
    noneBtn.background = '#2a5a3a';

    const uniqueCourses = new Set<string>();
    for (const s of SCENARIOS) {
      if (!uniqueCourses.has(s.courseId)) {
        uniqueCourses.add(s.courseId);
        const course = getCourseById(s.courseId);
        if (course) {
          this.createTemplateOption(row, course.name.substring(0, 12), s.courseId);
        }
      }
      if (uniqueCourses.size >= 3) break;
    }
  }

  private createTemplateOption(parent: StackPanel, label: string, courseId: string): Rectangle {
    const btn = new Rectangle();
    btn.width = '80px';
    btn.height = '24px';
    btn.cornerRadius = 3;
    btn.background = '#1a2a20';
    btn.color = '#3a5a4a';
    btn.thickness = 1;
    btn.paddingLeft = '2px';
    btn.paddingRight = '2px';
    btn.isPointerBlocker = true;

    const text = new TextBlock();
    text.text = label;
    text.color = '#aaccaa';
    text.fontSize = 9;
    text.fontFamily = 'Arial, sans-serif';
    text.isPointerBlocker = false;
    btn.addControl(text);

    btn.onPointerUpObservable.add(() => {
      this.templateId = courseId;
      parent.children.forEach(c => {
        if (c instanceof Rectangle) c.background = '#1a2a20';
      });
      btn.background = '#2a5a3a';
    });

    parent.addControl(btn);
    return btn;
  }

  private addButton(parent: StackPanel, label: string, bg: string, onClick: () => void): void {
    const btn = new Rectangle();
    btn.width = '120px';
    btn.height = '35px';
    btn.cornerRadius = 6;
    btn.background = bg;
    btn.color = '#7FFF7F';
    btn.thickness = 2;
    btn.isPointerBlocker = true;

    const text = new TextBlock();
    text.text = label.toUpperCase();
    text.color = 'white';
    text.fontSize = 13;
    text.fontFamily = 'Arial, sans-serif';
    text.isPointerBlocker = false;
    btn.addControl(text);

    btn.onPointerUpObservable.add(onClick);
    btn.onPointerEnterObservable.add(() => { btn.alpha = 0.85; });
    btn.onPointerOutObservable.add(() => { btn.alpha = 1; });

    parent.addControl(btn);
  }

  private addSpacer(parent: StackPanel, width: string): void {
    const spacer = new Rectangle();
    spacer.width = width;
    spacer.height = '1px';
    spacer.thickness = 0;
    spacer.background = 'transparent';
    parent.addControl(spacer);
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
    if (this.errorText) this.errorText.text = msg;
  }

  public dispose(): void {
    this.overlay.dispose();
  }
}
