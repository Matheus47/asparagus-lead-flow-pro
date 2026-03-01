import React from 'react';
import { Badge } from '@/components/ui/badge';

const channelConfig = {
  paid_search: { label: 'Paid Search', color: 'channel-paid-search' },
  paid_social: { label: 'Paid Social', color: 'channel-paid-social' },
  organic_search: { label: 'Organic Search', color: 'channel-organic-search' },
  organic_social: { label: 'Organic Social', color: 'channel-organic-social' },
  email: { label: 'Email', color: 'channel-email' },
  referral: { label: 'Referral', color: 'channel-referral' },
  direct: { label: 'Direct', color: 'channel-direct' },
  unknown: { label: 'Unknown', color: 'channel-unknown' }
};

export default function ChannelBadge({ channel, className = '' }) {
  const config = channelConfig[channel] || channelConfig.unknown;
  
  return (
    <Badge className={`${config.color} ${className}`}>
      {config.label}
    </Badge>
  );
}