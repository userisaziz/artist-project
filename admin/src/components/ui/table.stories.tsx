import type { Meta, StoryObj } from "@storybook/react";

import { Badge } from "./badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

const meta = {
  title: "Components/UI/Table",
  component: Table,
  tags: ["autodocs"],
} satisfies Meta<typeof Table>;

export default meta;

type Story = StoryObj<typeof meta>;

const BOOKINGS = [
  { id: "BK-1042", artist: "Priya Sharma", service: "Bridal makeup", status: "Confirmed" },
  { id: "BK-1043", artist: "Rahul Kapoor", service: "Live guitar", status: "Pending" },
  { id: "BK-1044", artist: "Aisha Mehta", service: "Mehendi", status: "Cancelled" },
];

const STATUS_VARIANT = {
  Confirmed: "success",
  Pending: "warning",
  Cancelled: "danger",
} as const;

export const Default: Story = {
  render: (args) => (
    <Table {...args}>
      <TableCaption>Recent bookings</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Booking</TableHead>
          <TableHead>Artist</TableHead>
          <TableHead>Service</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {BOOKINGS.map((booking) => (
          <TableRow key={booking.id}>
            <TableCell className="font-medium">{booking.id}</TableCell>
            <TableCell>{booking.artist}</TableCell>
            <TableCell>{booking.service}</TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[booking.status as keyof typeof STATUS_VARIANT]}>
                {booking.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total</TableCell>
          <TableCell>{BOOKINGS.length} bookings</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
};
