import { useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { toast } from "sonner";

import { Button } from "./button";
import { Toaster } from "./sonner";

const meta = {
  title: "Components/UI/Toaster",
  component: Toaster,
  tags: ["autodocs"],
  args: {
    position: "top-center",
  },
} satisfies Meta<typeof Toaster>;

export default meta;

type Story = StoryObj<typeof meta>;

function ToastOnMount({ show }: { show: () => void }) {
  useEffect(() => {
    show();
  }, [show]);
  return null;
}

const showSuccess = () =>
  toast.success("Artist approved", { description: "Priya Sharma can now accept bookings.", duration: Infinity });
const showError = () =>
  toast.error("Could not save category", { description: "Slug is already in use.", duration: Infinity });

export const Success: Story = {
  render: (args) => (
    <>
      <Toaster {...args} />
      <ToastOnMount show={showSuccess} />
    </>
  ),
};

export const ErrorToast: Story = {
  render: (args) => (
    <>
      <Toaster {...args} />
      <ToastOnMount show={showError} />
    </>
  ),
};

export const Trigger: Story = {
  render: (args) => (
    <>
      <Toaster {...args} />
      <Button variant="outline" onClick={() => toast("Export started")}>
        Show toast
      </Button>
    </>
  ),
};
