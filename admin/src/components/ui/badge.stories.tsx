import type { Meta, StoryObj } from "@storybook/react";

import { Badge } from "./badge";

const meta = {
  title: "Components/UI/Badge",
  component: Badge,
  tags: ["autodocs"],
  args: {
    children: "Badge",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "destructive", "outline", "ghost", "link", "success", "warning", "brand", "danger", "neutral"],
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const StatusTones: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="success">Verified</Badge>
      <Badge variant="warning">Pending KYC</Badge>
      <Badge variant="brand">Review</Badge>
      <Badge variant="danger">Suspended</Badge>
      <Badge variant="neutral">Draft</Badge>
    </div>
  ),
};
