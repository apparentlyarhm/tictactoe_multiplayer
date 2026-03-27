"use client";

import { useEffect, useState } from "react";
import { Modal, Button, IconPlus, IconChevronRight } from "@heroui/react";
import { useRouter } from "next/navigation";
import { nunito } from "../config/fonts";

type Props = {
  opponentName: string;
  matchId: string;
  isMobile?: boolean;
  isOpen: boolean;
};

export function MatchFoundDialog({
  opponentName,
  matchId,
  isMobile = false,
  isOpen,
}: Props) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (!isOpen) return;

    setCountdown(3);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
          
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, matchId, router]);

  useEffect(() => {
    if (countdown === 0) {
      router.push(`/game?matchId=${matchId}`);
    }
  }, [countdown])

  return (
    <Modal isOpen={isOpen}>
      <Modal.Backdrop variant="blur">
        <Modal.Container placement="top">
          <Modal.Dialog className={`${isMobile ? "max-w-[90%]" : "sm:max-w-95"} bg-black text-white ${nunito.className}`}>
            <Modal.Header>
              <Modal.Icon>
                <IconChevronRight className="size-10" />
              </Modal.Icon>
              <Modal.Heading className="font-black text-3xl text-center">Match Found!</Modal.Heading>
            </Modal.Header>

            <Modal.Body>
              <div className={`flex flex-col items-center justify-center gap-4 py-4`}>
                <p className="text-md">
                  <span className="font-semibold">{opponentName} is READY!</span>
                </p>

                <div className="text-7xl font-bold tracking-tight">
                  {countdown}
                </div>

                <p className="text-sm">
                  Brooo it aint that deep its just tic tac toe
                </p>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}