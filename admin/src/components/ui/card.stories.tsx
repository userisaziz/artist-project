import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";

const meta = {
  title: "Components/UI/Card",
  component: Card,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["default", "sm"],
    },
  },
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Card {...args} className="w-80">
      <CardHeader>
        <CardTitle>Pending approvals</CardTitle>
        <CardDescription>Artists waiting for KYC review</CardDescription>
        <CardAction>
          <Button size="sm" variant="outline">View all</Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">24</p>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-muted-foreground">Updated 5 minutes ago</p>
      </CardFooter>
    </Card>
  ),
};

export const Small: Story = {
  render: (args) => (
    <Card {...args} size="sm" className="w-64">
      <CardHeader>
        <CardTitle>Bookings today</CardTitle>
        <CardDescription>Across all categories</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">138</p>
      </CardContent>
    </Card>
  ),
};
