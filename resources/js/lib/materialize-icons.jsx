import React from 'react';

/**
 * Global Materialize / Google Material Icons adapter.
 * Ensures every icon across all components renders in a clean, uniform Materialize icon style.
 */
export function MaterialIcon({
  name,
  size = 18,
  color,
  className = '',
  style = {},
  title,
  onClick,
  filled = false,
}) {
  const numericSize = typeof size === 'number' ? `${size}px` : size;
  return (
    <i
      className={`materialize-icon ${className}`.trim()}
      title={title}
      onClick={onClick}
      aria-hidden="true"
      style={{
        fontFamily: filled ? "'Material Icons', sans-serif" : "'Material Icons Outlined', 'Material Icons', sans-serif",
        fontSize: numericSize,
        width: numericSize,
        height: numericSize,
        color: color || style?.color || 'currentColor',
        ...style,
      }}
    >
      {name}
    </i>
  );
}

const createMaterialIcon = (ligature, filled = false) => {
  const IconComp = ({ size = 18, color, className = '', style = {}, title, onClick }) => (
    <MaterialIcon
      name={ligature}
      size={size}
      color={color}
      className={className}
      style={style}
      title={title}
      onClick={onClick}
      filled={filled}
    />
  );
  IconComp.displayName = `Material_${ligature}`;
  return IconComp;
};

export const Activity = createMaterialIcon('timeline');
export const AlertCircle = createMaterialIcon('error_outline');
export const AlertTriangle = createMaterialIcon('warning_amber');
export const Archive = createMaterialIcon('inventory_2');
export const ArrowLeft = createMaterialIcon('arrow_back');
export const ArrowRight = createMaterialIcon('arrow_forward');
export const ArrowUpRight = createMaterialIcon('north_east');
export const Award = createMaterialIcon('emoji_events');
export const BarChart2 = createMaterialIcon('bar_chart');
export const Bell = createMaterialIcon('notifications');
export const BookOpen = createMaterialIcon('menu_book');
export const Bug = createMaterialIcon('bug_report');
export const Building = createMaterialIcon('business');
export const Building2 = createMaterialIcon('domain');
export const Calendar = createMaterialIcon('calendar_today');
export const Check = createMaterialIcon('check');
export const CheckCircle = createMaterialIcon('check_circle');
export const CheckCircle2 = createMaterialIcon('check_circle');
export const CheckSquare = createMaterialIcon('check_box');
export const ChevronDown = createMaterialIcon('expand_more');
export const ChevronLeft = createMaterialIcon('chevron_left');
export const ChevronRight = createMaterialIcon('chevron_right');
export const ChevronUp = createMaterialIcon('expand_less');
export const Code = createMaterialIcon('code');
export const Coins = createMaterialIcon('paid');
export const Compass = createMaterialIcon('explore');
export const Copy = createMaterialIcon('content_copy');
export const Cpu = createMaterialIcon('memory');
export const CreditCard = createMaterialIcon('credit_card');
export const Download = createMaterialIcon('file_download');
export const Edit2 = createMaterialIcon('edit');
export const ExternalLink = createMaterialIcon('open_in_new');
export const Eye = createMaterialIcon('visibility');
export const FileText = createMaterialIcon('description');
export const Filter = createMaterialIcon('filter_list');
export const Globe = createMaterialIcon('language');
export const HelpCircle = createMaterialIcon('help_outline');
export const History = createMaterialIcon('history');
export const Info = createMaterialIcon('info');
export const Key = createMaterialIcon('vpn_key');
export const Layers = createMaterialIcon('layers');
export const LayoutDashboard = createMaterialIcon('dashboard');
export const Loader2 = createMaterialIcon('autorenew');
export const Lock = createMaterialIcon('lock');
export const LockKeyhole = createMaterialIcon('lock');
export const LogOut = createMaterialIcon('logout');
export const Mail = createMaterialIcon('mail');
export const Megaphone = createMaterialIcon('campaign');
export const MessageSquare = createMaterialIcon('chat_bubble_outline');
export const Minus = createMaterialIcon('remove');
export const NewReleases = createMaterialIcon('new_releases');
export const Play = createMaterialIcon('play_arrow', true);
export const Plus = createMaterialIcon('add');
export const Receipt = createMaterialIcon('receipt_long');
export const RefreshCw = createMaterialIcon('refresh');
export const Rocket = createMaterialIcon('rocket_launch');
export const RotateCcw = createMaterialIcon('undo');
export const RotateCw = createMaterialIcon('sync');
export const Search = createMaterialIcon('search');
export const Settings = createMaterialIcon('settings');
export const Share2 = createMaterialIcon('share');
export const Shield = createMaterialIcon('shield');
export const ShieldAlert = createMaterialIcon('gpp_maybe');
export const ShieldCheck = createMaterialIcon('verified_user');
export const Sliders = createMaterialIcon('tune');
export const SlidersHorizontal = createMaterialIcon('tune');
export const Sparkles = createMaterialIcon('auto_awesome');
export const Square = createMaterialIcon('check_box_outline_blank');
export const Star = createMaterialIcon('star_border');
export const Tag = createMaterialIcon('sell');
export const Terminal = createMaterialIcon('terminal');
export const ThumbsUp = createMaterialIcon('thumb_up');
export const Trash2 = createMaterialIcon('delete');
export const TrendingDown = createMaterialIcon('trending_down');
export const TrendingUp = createMaterialIcon('trending_up');
export const User = createMaterialIcon('person');
export const UserPlus = createMaterialIcon('person_add');
export const Users = createMaterialIcon('group');
export const Wallet = createMaterialIcon('account_balance_wallet');
export const X = createMaterialIcon('close');
export const Zap = createMaterialIcon('bolt');

export default MaterialIcon;
