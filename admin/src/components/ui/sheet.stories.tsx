import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

const meta = {
  title: "Components/UI/Sheet",
  component: Sheet,
  tags: ["autodocs"],
  args: {
    defaultOpen: true,
  },
} satisfies Meta<typeof Sheet>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Right: Story = {
  render: (args) => (
    <Sheet {...args}>
      <SheetTrigger render={<Button variant="outline" />}>Open details</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Booking details</SheetTitle>
          <SheetDescription>Everything about this booking in one place.</SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <Button>Done</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

export const Left: Story = {
  render: (args) => (
    <Sheet {...args}>
      <SheetTrigger render={<Button variant="outline" />}>Open navigation</SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
};

export const WithoutCloseButton: Story = {
  render: (args) => (
    <Sheet {...args}>
      <SheetTrigger render={<Button variant="outline" />}>Open</SheetTrigger>
      <SheetContent side="bottom" showCloseButton={false}>
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Tap outside to close.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
};
