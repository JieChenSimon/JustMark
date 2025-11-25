// 字体大小选项
export const FONT_OPTIONS = [
  { label: 'Small',  size: 'text-sm',   leading: 'leading-6', name: '小号' },
  { label: 'Medium', size: 'text-base', leading: 'leading-7', name: '中号' },
  { label: 'Large',  size: 'text-lg',   leading: 'leading-8', name: '大号' },
];

// 字体家族选项
export const FONT_FAMILIES = [
  { name: 'System',  family: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', nameZh: '系统' },
  { name: 'Serif',   family: 'Georgia, "Times New Roman", serif',                          nameZh: '衬线' },
  { name: 'Mono',    family: '"Courier New", Courier, monospace',                          nameZh: '等宽' },
];

// 主题颜色配置（应用到整个应用）
export const BACKGROUND_COLORS = [
  {
    name: 'Paper White',
    bg: '#FFFFFF',
    text: '#1D1D1F',
    description: 'Pure & clean'
  },
  {
    name: 'Light Gray',
    bg: '#F5F5F7',
    text: '#1D1D1F',
    description: 'Default neutral'
  },
  {
    name: 'Sepia',
    bg: '#F4ECD8',
    text: '#3D2817',
    description: 'Warm & comfortable'
  },
  {
    name: 'Green Tea',
    bg: '#E3EDCD',
    text: '#2C3A1E',
    description: 'Eye protection'
  },
  {
    name: 'Blue Light',
    bg: '#E8F4F8',
    text: '#1F3A47',
    description: 'Calm & soothing'
  },
];

// 头部高度
export const HEADER_HEIGHT = 'h-10';
