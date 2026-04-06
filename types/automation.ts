export type Offer = {
  headline: string;
  subheadline: string;
  cta: string;
};

export type FunnelBlock = {
  channel: string;
  steps: string[];
};

export type GeneratedAutomation = {
  projectName: string;
  businessType: string;
  goal: string;

  offer: Offer;

  aquisicaoLocal: FunnelBlock;
  aquisicaoOnline: FunnelBlock;

  followups: string[];
  metrics: {
    mainGoal: string;
  };
};