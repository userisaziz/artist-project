import { FormScreen, FormHeading } from '../../../src/components/FormScreen';

export default function ServicesStep() {
  return (
    <FormScreen step={2} steps={3}>
      <FormHeading eyebrow="STEP 2 · SERVICES" title="Set your" accent="prices" />
    </FormScreen>
  );
}
