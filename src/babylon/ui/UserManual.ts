import { Scene } from '@babylonjs/core/scene';
import { Engine } from '@babylonjs/core/Engines/engine';
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { ScrollViewer } from '@babylonjs/gui/2D/controls/scrollViewers/scrollViewer';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';

import { EMPLOYEE_ROLE_INFO, EmployeeRole } from '../../core/employees';
import { FocusManager } from './FocusManager';
import { AccessibleButton, createAccessibleButton } from './AccessibleButton';

export interface UserManualCallbacks {
  onClose: () => void;
}

interface GuideSection {
  id: string;
  label: string;
  icon: string;
}

const GUIDE_SECTIONS: GuideSection[] = [
  { id: 'employees', label: 'Employees', icon: '👷' },
  { id: 'equipment', label: 'Equipment', icon: '🚜' },
  { id: 'course', label: 'Course Care', icon: '⛳' },
  { id: 'economy', label: 'Economy', icon: '💰' },
];

export class UserManual {
  private advancedTexture: AdvancedDynamicTexture;
  private ownsTexture: boolean;
  private callbacks: UserManualCallbacks;
  private container: Rectangle;
  private focusManager: FocusManager;
  private backButton: AccessibleButton | null = null;
  private scrollViewer: ScrollViewer | null = null;
  private sectionContainers: Map<string, StackPanel> = new Map();
  private navButtons: Map<string, Rectangle> = new Map();
  private currentSection: string = 'employees';

  constructor(_engine: Engine, scene: Scene, callbacks: UserManualCallbacks, sharedTexture?: AdvancedDynamicTexture) {
    this.callbacks = callbacks;
    if (sharedTexture) {
      this.advancedTexture = sharedTexture;
      this.ownsTexture = false;
    } else {
      this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI('UserManualUI', true, scene);
      this.ownsTexture = true;
    }
    this.focusManager = new FocusManager(scene);

    this.container = new Rectangle('manualContainer');
    this.container.width = '100%';
    this.container.height = '100%';
    this.container.background = '#0d1f15';
    this.container.thickness = 0;

    this.buildUI();
  }

  private buildUI(): void {
    const mainGrid = new Grid('mainGrid');
    mainGrid.width = '100%';
    mainGrid.height = '100%';
    mainGrid.paddingTop = '20px';
    mainGrid.paddingBottom = '10px';

    mainGrid.addRowDefinition(80, true);
    mainGrid.addRowDefinition(1.0);
    mainGrid.addRowDefinition(60, true);
    mainGrid.addColumnDefinition(1.0);

    this.container.addControl(mainGrid);

    this.createHeader(mainGrid);
    this.createContent(mainGrid);
    this.createFooter(mainGrid);
  }

  private createHeader(parent: Grid): void {
    const headerContainer = new Rectangle('headerContainer');
    headerContainer.width = '100%';
    headerContainer.height = '100%';
    headerContainer.thickness = 0;
    headerContainer.background = 'transparent';
    parent.addControl(headerContainer, 0, 0);

    const headerStack = new StackPanel('headerStack');
    headerContainer.addControl(headerStack);

    const icon = new TextBlock('manualIcon');
    icon.text = '📖';
    icon.fontSize = 32;
    icon.height = '40px';
    headerStack.addControl(icon);

    const title = new TextBlock('manualTitle');
    title.text = 'GREENKEEPER GUIDE';
    title.color = '#7FFF7F';
    title.fontSize = 24;
    title.fontFamily = 'Arial Black, sans-serif';
    title.height = '35px';
    headerStack.addControl(title);
  }

  private createContent(parent: Grid): void {
    const contentGrid = new Grid('contentGrid');
    contentGrid.width = '100%';
    contentGrid.height = '100%';
    contentGrid.addColumnDefinition(180, true);
    contentGrid.addColumnDefinition(1.0);
    parent.addControl(contentGrid, 1, 0);

    this.createSidebar(contentGrid);
    this.createMainContent(contentGrid);
  }

  private createSidebar(parent: Grid): void {
    const sidebar = new Rectangle('sidebar');
    sidebar.width = '100%';
    sidebar.height = '100%';
    sidebar.thickness = 0;
    sidebar.background = 'rgba(20, 40, 30, 0.8)';
    sidebar.paddingTop = '10px';
    sidebar.paddingLeft = '10px';
    sidebar.paddingRight = '10px';
    parent.addControl(sidebar, 0, 0);

    const navStack = new StackPanel('navStack');
    navStack.width = '100%';
    navStack.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    sidebar.addControl(navStack);

    const navHeader = new TextBlock('navHeader');
    navHeader.text = 'SECTIONS';
    navHeader.color = '#5a7a6a';
    navHeader.fontSize = 11;
    navHeader.fontFamily = 'Arial, sans-serif';
    navHeader.height = '25px';
    navHeader.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    navStack.addControl(navHeader);

    for (const section of GUIDE_SECTIONS) {
      const navItem = this.createNavItem(section);
      navStack.addControl(navItem);
    }
  }

  private createNavItem(section: GuideSection): Rectangle {
    const item = new Rectangle(`nav_${section.id}`);
    item.width = '100%';
    item.height = '40px';
    item.cornerRadius = 6;
    item.thickness = 0;
    item.paddingTop = '2px';
    item.paddingBottom = '2px';

    this.updateNavItemStyle(item, section.id === this.currentSection);
    this.navButtons.set(section.id, item);

    const itemStack = new StackPanel(`navItemStack_${section.id}`);
    itemStack.isVertical = false;
    itemStack.width = '100%';
    itemStack.height = '100%';
    item.addControl(itemStack);

    const icon = new TextBlock(`navIcon_${section.id}`);
    icon.text = section.icon;
    icon.fontSize = 16;
    icon.width = '30px';
    icon.isPointerBlocker = false;
    itemStack.addControl(icon);

    const label = new TextBlock(`navLabel_${section.id}`);
    label.text = section.label;
    label.color = '#aaccaa';
    label.fontSize = 13;
    label.fontFamily = 'Arial, sans-serif';
    label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    label.isPointerBlocker = false;
    itemStack.addControl(label);

    item.isPointerBlocker = true;
    item.onPointerEnterObservable.add(() => {
      if (section.id !== this.currentSection) {
        item.background = 'rgba(74, 138, 90, 0.3)';
      }
    });
    item.onPointerOutObservable.add(() => {
      this.updateNavItemStyle(item, section.id === this.currentSection);
    });
    item.onPointerUpObservable.add(() => {
      this.navigateToSection(section.id);
    });

    return item;
  }

  private updateNavItemStyle(item: Rectangle, isActive: boolean): void {
    if (isActive) {
      item.background = 'rgba(74, 138, 90, 0.6)';
    } else {
      item.background = 'transparent';
    }
  }

  public navigateToSection(sectionId: string): void {
    if (!this.sectionContainers.has(sectionId)) {
      console.warn(`Unknown section: ${sectionId}`);
      return;
    }

    const prevButton = this.navButtons.get(this.currentSection);
    if (prevButton) {
      this.updateNavItemStyle(prevButton, false);
    }

    this.currentSection = sectionId;

    const newButton = this.navButtons.get(sectionId);
    if (newButton) {
      this.updateNavItemStyle(newButton, true);
    }

    if (this.scrollViewer) {
      const sectionContainer = this.sectionContainers.get(sectionId);
      if (sectionContainer) {
        this.scrollViewer.verticalBar.value = 0;
        const targetTop = sectionContainer.topInPixels;
        if (targetTop > 0) {
          const scrollRatio = targetTop / (this.scrollViewer.heightInPixels * 3);
          this.scrollViewer.verticalBar.value = Math.min(1, scrollRatio);
        }
      }
    }
  }

  public getCurrentSection(): string {
    return this.currentSection;
  }

  public getAvailableSections(): { id: string; label: string }[] {
    return GUIDE_SECTIONS.map(s => ({ id: s.id, label: s.label }));
  }

  private createMainContent(parent: Grid): void {
    const contentContainer = new Rectangle('contentContainer');
    contentContainer.width = '100%';
    contentContainer.height = '100%';
    contentContainer.thickness = 0;
    contentContainer.background = 'transparent';
    parent.addControl(contentContainer, 0, 1);

    this.scrollViewer = new ScrollViewer('manualScroll');
    this.scrollViewer.width = '100%';
    this.scrollViewer.height = '100%';
    this.scrollViewer.barColor = '#4a8a5a';
    this.scrollViewer.barBackground = '#1a3a2a';
    this.scrollViewer.thickness = 0;
    this.scrollViewer.paddingLeft = '20px';
    this.scrollViewer.paddingRight = '20px';
    contentContainer.addControl(this.scrollViewer);

    const contentStack = new StackPanel('contentStack');
    contentStack.width = '100%';
    this.scrollViewer.addControl(contentStack);

    this.createEmployeeSection(contentStack);
    this.createEquipmentSection(contentStack);
    this.createCourseSection(contentStack);
    this.createEconomySection(contentStack);
  }

  private createEmployeeSection(parent: StackPanel): void {
    const sectionContainer = new StackPanel('employeesSection');
    sectionContainer.width = '100%';
    this.sectionContainers.set('employees', sectionContainer);
    parent.addControl(sectionContainer);

    const sectionHeader = new TextBlock('employeeSectionHeader');
    sectionHeader.text = 'EMPLOYEE TYPES';
    sectionHeader.color = '#7FFF7F';
    sectionHeader.fontSize = 18;
    sectionHeader.fontFamily = 'Arial Black, sans-serif';
    sectionHeader.height = '50px';
    sectionHeader.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    sectionContainer.addControl(sectionHeader);

    const roleOrder: EmployeeRole[] = [
      'groundskeeper', 'mechanic', 'pro_shop_staff', 'manager', 'caddy'
    ];

    for (const roleId of roleOrder) {
      const roleInfo = EMPLOYEE_ROLE_INFO[roleId];
      const card = this.createEmployeeCard(roleInfo);
      sectionContainer.addControl(card);
    }

    this.addSectionSpacer(parent);
  }

  private createEquipmentSection(parent: StackPanel): void {
    const sectionContainer = new StackPanel('equipmentSection');
    sectionContainer.width = '100%';
    this.sectionContainers.set('equipment', sectionContainer);
    parent.addControl(sectionContainer);

    const sectionHeader = new TextBlock('equipmentSectionHeader');
    sectionHeader.text = 'EQUIPMENT';
    sectionHeader.color = '#7FFF7F';
    sectionHeader.fontSize = 18;
    sectionHeader.fontFamily = 'Arial Black, sans-serif';
    sectionHeader.height = '50px';
    sectionHeader.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    sectionContainer.addControl(sectionHeader);

    const placeholder = this.createPlaceholderCard(
      '🚜',
      'Equipment Guide Coming Soon',
      'Learn about mowers, sprinklers, spreaders, and autonomous equipment. Understand maintenance schedules and upgrade paths.'
    );
    sectionContainer.addControl(placeholder);

    this.addSectionSpacer(parent);
  }

  private createCourseSection(parent: StackPanel): void {
    const sectionContainer = new StackPanel('courseSection');
    sectionContainer.width = '100%';
    this.sectionContainers.set('course', sectionContainer);
    parent.addControl(sectionContainer);

    const sectionHeader = new TextBlock('courseSectionHeader');
    sectionHeader.text = 'COURSE CARE';
    sectionHeader.color = '#7FFF7F';
    sectionHeader.fontSize = 18;
    sectionHeader.fontFamily = 'Arial Black, sans-serif';
    sectionHeader.height = '50px';
    sectionHeader.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    sectionContainer.addControl(sectionHeader);

    const placeholder = this.createPlaceholderCard(
      '⛳',
      'Course Care Guide Coming Soon',
      'Master turf health, irrigation timing, fertilization strategies, and seasonal maintenance. Keep your fairways, greens, and rough in perfect condition.'
    );
    sectionContainer.addControl(placeholder);

    this.addSectionSpacer(parent);
  }

  private createEconomySection(parent: StackPanel): void {
    const sectionContainer = new StackPanel('economySection');
    sectionContainer.width = '100%';
    this.sectionContainers.set('economy', sectionContainer);
    parent.addControl(sectionContainer);

    const sectionHeader = new TextBlock('economySectionHeader');
    sectionHeader.text = 'ECONOMY';
    sectionHeader.color = '#7FFF7F';
    sectionHeader.fontSize = 18;
    sectionHeader.fontFamily = 'Arial Black, sans-serif';
    sectionHeader.height = '50px';
    sectionHeader.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    sectionContainer.addControl(sectionHeader);

    const placeholder = this.createPlaceholderCard(
      '💰',
      'Economy Guide Coming Soon',
      'Understand revenue streams, manage expenses, plan investments, and grow your golf course business. Tips for maximizing profits while maintaining quality.'
    );
    sectionContainer.addControl(placeholder);
  }

  private createPlaceholderCard(icon: string, title: string, description: string): Rectangle {
    const card = new Rectangle('placeholderCard');
    card.width = '95%';
    card.height = '120px';
    card.cornerRadius = 8;
    card.thickness = 1;
    card.color = '#3a5a4a';
    card.background = '#1a3a2a';
    card.paddingTop = '8px';
    card.paddingBottom = '8px';

    const cardStack = new StackPanel('placeholderStack');
    cardStack.width = '100%';
    cardStack.paddingLeft = '20px';
    cardStack.paddingRight = '20px';
    card.addControl(cardStack);

    const iconText = new TextBlock('placeholderIcon');
    iconText.text = icon;
    iconText.fontSize = 32;
    iconText.height = '45px';
    cardStack.addControl(iconText);

    const titleText = new TextBlock('placeholderTitle');
    titleText.text = title;
    titleText.color = '#88aa88';
    titleText.fontSize = 14;
    titleText.fontFamily = 'Arial, sans-serif';
    titleText.height = '25px';
    cardStack.addControl(titleText);

    const descText = new TextBlock('placeholderDesc');
    descText.text = description;
    descText.color = '#6a8a7a';
    descText.fontSize = 11;
    descText.fontFamily = 'Arial, sans-serif';
    descText.height = '35px';
    descText.textWrapping = true;
    cardStack.addControl(descText);

    return card;
  }

  private addSectionSpacer(parent: StackPanel): void {
    const spacer = new Rectangle('sectionSpacer');
    spacer.width = '100%';
    spacer.height = '30px';
    spacer.thickness = 0;
    spacer.background = 'transparent';
    parent.addControl(spacer);
  }

  private createEmployeeCard(roleInfo: typeof EMPLOYEE_ROLE_INFO[EmployeeRole]): Rectangle {
    const card = new Rectangle(`card_${roleInfo.id}`);
    card.width = '90%';
    card.height = '160px';
    card.cornerRadius = 8;
    card.thickness = 1;
    card.color = '#3a5a4a';
    card.background = '#1a3a2a';
    card.paddingTop = '8px';
    card.paddingBottom = '8px';

    const cardGrid = new Grid('cardGrid');
    cardGrid.width = '100%';
    cardGrid.height = '100%';
    cardGrid.addColumnDefinition(80, true);
    cardGrid.addColumnDefinition(1.0);
    card.addControl(cardGrid);

    const iconContainer = new Rectangle('iconContainer');
    iconContainer.width = '100%';
    iconContainer.height = '100%';
    iconContainer.thickness = 0;
    iconContainer.background = 'transparent';
    cardGrid.addControl(iconContainer, 0, 0);

    const icon = new TextBlock('roleIcon');
    icon.text = roleInfo.icon;
    icon.fontSize = 40;
    iconContainer.addControl(icon);

    const infoStack = new StackPanel('infoStack');
    infoStack.paddingLeft = '10px';
    infoStack.paddingRight = '10px';
    cardGrid.addControl(infoStack, 0, 1);

    const nameText = new TextBlock('roleName');
    nameText.text = roleInfo.name;
    nameText.color = 'white';
    nameText.fontSize = 16;
    nameText.fontFamily = 'Arial, sans-serif';
    nameText.height = '24px';
    nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(nameText);

    const descText = new TextBlock('roleDesc');
    descText.text = roleInfo.description;
    descText.color = '#aaccaa';
    descText.fontSize = 12;
    descText.fontFamily = 'Arial, sans-serif';
    descText.height = '40px';
    descText.textWrapping = true;
    descText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    descText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    infoStack.addControl(descText);

    const columnsGrid = new Grid('columnsGrid');
    columnsGrid.width = '100%';
    columnsGrid.height = '80px';
    columnsGrid.addColumnDefinition(0.5);
    columnsGrid.addColumnDefinition(0.5);
    infoStack.addControl(columnsGrid);

    const dutiesStack = new StackPanel('dutiesStack');
    dutiesStack.paddingRight = '10px';
    columnsGrid.addControl(dutiesStack, 0, 0);

    const dutiesHeader = new TextBlock('dutiesHeader');
    dutiesHeader.text = 'Duties';
    dutiesHeader.color = '#88aa88';
    dutiesHeader.fontSize = 11;
    dutiesHeader.fontFamily = 'Arial, sans-serif';
    dutiesHeader.height = '16px';
    dutiesHeader.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    dutiesStack.addControl(dutiesHeader);

    for (const duty of roleInfo.duties) {
      const dutyText = new TextBlock();
      dutyText.text = `• ${duty}`;
      dutyText.color = '#7a9a8a';
      dutyText.fontSize = 10;
      dutyText.fontFamily = 'Arial, sans-serif';
      dutyText.height = '14px';
      dutyText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      dutiesStack.addControl(dutyText);
    }

    const benefitsStack = new StackPanel('benefitsStack');
    columnsGrid.addControl(benefitsStack, 0, 1);

    const benefitsHeader = new TextBlock('benefitsHeader');
    benefitsHeader.text = 'Benefits';
    benefitsHeader.color = '#88aa88';
    benefitsHeader.fontSize = 11;
    benefitsHeader.fontFamily = 'Arial, sans-serif';
    benefitsHeader.height = '16px';
    benefitsHeader.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    benefitsStack.addControl(benefitsHeader);

    for (const benefit of roleInfo.benefits) {
      const benefitText = new TextBlock();
      benefitText.text = `✓ ${benefit}`;
      benefitText.color = '#7a9a8a';
      benefitText.fontSize = 10;
      benefitText.fontFamily = 'Arial, sans-serif';
      benefitText.height = '14px';
      benefitText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      benefitsStack.addControl(benefitText);
    }

    return card;
  }

  private createFooter(parent: Grid): void {
    const footer = new Rectangle('footer');
    footer.width = '100%';
    footer.height = '100%';
    footer.thickness = 0;
    footer.background = 'rgba(26, 58, 42, 0.5)';
    parent.addControl(footer, 2, 0);

    const buttonRow = new StackPanel('buttonRow');
    buttonRow.isVertical = false;
    buttonRow.height = '50px';
    buttonRow.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    footer.addControl(buttonRow);

    this.backButton = createAccessibleButton({
      label: '← BACK TO MENU',
      backgroundColor: '#5a6a7a',
      onClick: () => {
        this.callbacks.onClose();
      },
      focusGroup: 'manual-buttons'
    }, this.focusManager);
    buttonRow.addControl(this.backButton.control);
  }

  public show(): void {
    this.advancedTexture.addControl(this.container);
    this.container.isVisible = true;
    this.focusManager.enableForGroup('manual-buttons', 0);
  }

  public hide(): void {
    this.container.isVisible = false;
    this.advancedTexture.removeControl(this.container);
    this.focusManager.disable();
  }

  public isVisible(): boolean {
    return this.container.isVisible;
  }

  public dispose(): void {
    this.focusManager.dispose();
    this.container.dispose();
    if (this.ownsTexture) {
      this.advancedTexture.dispose();
    }
  }
}
