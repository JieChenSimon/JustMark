// ==============================================
// 🛠️ 核心配置常量
// ==============================================

// 头部高度
export const HEADER_HEIGHT = 'h-8';

// 广受好评的字体配置（包含中文支持）
export const FONT_FAMILIES = [
  {
    name: 'System Default',
    nameZh: '系统默认',
    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
    description: 'Clean and modern'
  },
  {
    name: 'Monospace',
    nameZh: '等宽字体',
    family: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    description: 'Perfect for code'
  },
  {
    name: 'Serif',
    nameZh: '衬线字体',
    family: 'Georgia, Cambria, "Times New Roman", Times, serif',
    description: 'Classic and elegant'
  },
  {
    name: 'PingFang SC',
    nameZh: '苹方-简',
    family: '"PingFang SC", -apple-system, BlinkMacSystemFont, sans-serif',
    description: 'Apple Chinese (Simplified)'
  },
  {
    name: 'PingFang TC',
    nameZh: '苹方-繁',
    family: '"PingFang TC", -apple-system, BlinkMacSystemFont, sans-serif',
    description: 'Apple Chinese (Traditional)'
  },
  {
    name: 'Hiragino Sans',
    nameZh: '冬青黑体',
    family: '"Hiragino Sans GB", "Hiragino Sans", "Microsoft YaHei", 微软雅黑, sans-serif',
    description: 'Elegant Chinese/Japanese'
  },
  {
    name: 'STSong',
    nameZh: '华文宋体',
    family: 'STSong, "Songti SC", SimSun, serif',
    description: 'Traditional Chinese serif'
  },
  {
    name: 'Noto Sans',
    nameZh: 'Noto 黑体',
    family: '"Noto Sans SC", "Noto Sans", sans-serif',
    description: 'Google multilingual'
  },
  {
    name: 'Source Han Sans',
    nameZh: '思源黑体',
    family: '"Source Han Sans SC", "Source Han Sans CN", sans-serif',
    description: 'Adobe open source'
  },
];

// 字体大小选项
export const FONT_OPTIONS = [
  { label: 'Tiny', size: 'text-xs', leading: 'leading-5', name: 'Tiny' },
  { label: 'Small', size: 'text-sm', leading: 'leading-6', name: 'Small' },
  { label: 'Medium', size: 'text-base', leading: 'leading-7', name: 'Medium' },
  { label: 'Large', size: 'text-lg', leading: 'leading-8', name: 'Large' },
  { label: 'XLarge', size: 'text-xl', leading: 'leading-9', name: 'Extra Large' },
];

// 阅读背景色配置
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
