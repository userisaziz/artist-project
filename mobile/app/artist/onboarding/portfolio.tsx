import { FormScreen, FormHeading } from '../../../src/components/FormScreen';

export default function PortfolioStep() {
  return (
    <FormScreen step={3} steps={3}>
      <FormHeading eyebrow="STEP 3 · PORTFOLIO" title="Show your" accent="best work" />
    </FormScreen>
  );
}
