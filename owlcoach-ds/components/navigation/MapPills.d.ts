import React from 'react';

export interface MapPillsProps {
  maps?: string[];
  /** currently selected map name */
  value: string;
  /** optional map → win% map; shows under each pill */
  winRates?: Record<string, number>;
  onChange?: (map: string) => void;
  style?: React.CSSProperties;
}

/**
 * Always-visible horizontal map picker; selected pill is mint.
 * @startingPoint section="Navigation" subtitle="Always-visible map picker pills" viewport="700x120"
 */
export function MapPills(props: MapPillsProps): JSX.Element;
