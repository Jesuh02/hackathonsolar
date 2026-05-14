import { Entity } from '@shared/domain/Entity';

export type BusinessType = 'hotel' | 'hielera' | 'retail' | 'oficina' | 'industrial';
export type Priority = 'critica' | 'alta' | 'media' | 'baja';

export interface RecommendationProps {
  businessName: string;
  businessType: BusinessType;
  date: string;
  recommendations: RecommendationItem[];
  energyScore: number;        // 0-100, potencial de ahorro
  estimatedSavings: number;   // kWh/mes estimado ahorrable
  generatedAt: Date;
}

export interface RecommendationItem {
  priority: Priority;
  category: 'operacional' | 'solar' | 'baterias' | 'demanda' | 'eficiencia';
  title: string;
  description: string;
  action: string;
  estimatedImpact: string;
  savingsCalculationExplanation?: string;
}

/**
 * Entidad: Recomendación Energética del Agente Solar
 */
export class Recommendation extends Entity<string> {
  private readonly props: RecommendationProps;

  private constructor(id: string, props: RecommendationProps) {
    super(id);
    this.props = props;
  }

  static create(props: RecommendationProps): Recommendation {
    const id = `rec-${props.businessName}-${props.date}-${Date.now()}`;
    return new Recommendation(id, props);
  }

  get businessName(): string { return this.props.businessName; }
  get businessType(): BusinessType { return this.props.businessType; }
  get date(): string { return this.props.date; }
  get recommendations(): RecommendationItem[] { return this.props.recommendations; }
  get energyScore(): number { return this.props.energyScore; }
  get estimatedSavings(): number { return this.props.estimatedSavings; }
  get generatedAt(): Date { return this.props.generatedAt; }

  getCriticalRecommendations(): RecommendationItem[] {
    return this.props.recommendations.filter((r) => r.priority === 'critica');
  }

  toJSON(): RecommendationProps & { id: string } {
    return { id: this.id, ...this.props };
  }
}
