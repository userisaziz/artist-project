import type { Meta, StoryObj } from "@storybook/react";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "./field";
import { Input } from "./input";
import { Switch } from "./switch";
import { Textarea } from "./textarea";

const meta = {
  title: "Components/UI/Field",
  component: Field,
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      control: "select",
      options: ["vertical", "horizontal", "responsive"],
    },
  },
} satisfies Meta<typeof Field>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Field {...args} className="w-80">
      <FieldLabel htmlFor="category-name">Category name</FieldLabel>
      <Input id="category-name" placeholder="Makeup" />
      <FieldDescription>Shown to customers in the app.</FieldDescription>
    </Field>
  ),
};

export const WithError: Story = {
  render: (args) => (
    <Field {...args} data-invalid className="w-80">
      <FieldLabel htmlFor="slug">Slug</FieldLabel>
      <Input id="slug" defaultValue="Makeup Artists" aria-invalid />
      <FieldError>Use lowercase letters and hyphens only.</FieldError>
    </Field>
  ),
};

export const Horizontal: Story = {
  render: (args) => (
    <Field {...args} orientation="horizontal" className="w-80">
      <FieldContent>
        <FieldLabel htmlFor="active">Active</FieldLabel>
        <FieldDescription>Hidden from customers when off.</FieldDescription>
      </FieldContent>
      <Switch id="active" defaultChecked />
    </Field>
  ),
};

export const Form: Story = {
  render: () => (
    <FieldSet className="w-96">
      <FieldLegend>Custom service</FieldLegend>
      <FieldDescription>Details reviewed before the service goes live.</FieldDescription>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="service-title">Title</FieldLabel>
          <Input id="service-title" placeholder="Destination wedding package" />
        </Field>
        <FieldSeparator />
        <Field>
          <FieldLabel htmlFor="service-notes">Notes</FieldLabel>
          <Textarea id="service-notes" placeholder="What is included" />
        </Field>
      </FieldGroup>
    </FieldSet>
  ),
};
