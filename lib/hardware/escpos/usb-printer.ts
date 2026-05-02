type UsbEndpointLike = {
  direction: "in" | "out";
  endpointNumber: number;
};

type UsbAlternateLike = {
  endpoints: UsbEndpointLike[];
};

type UsbInterfaceLike = {
  interfaceNumber: number;
  alternates: UsbAlternateLike[];
};

type UsbConfigurationLike = {
  interfaces: UsbInterfaceLike[];
};

type UsbDeviceLike = {
  opened: boolean;
  configuration: UsbConfigurationLike | null;
  open: () => Promise<void>;
  close: () => Promise<void>;
  selectConfiguration: (configurationValue: number) => Promise<void>;
  claimInterface: (interfaceNumber: number) => Promise<void>;
  releaseInterface: (interfaceNumber: number) => Promise<void>;
  transferOut: (endpointNumber: number, data: BufferSource) => Promise<unknown>;
};

type UsbLike = {
  requestDevice: (options: { filters: Array<Record<string, number>> }) => Promise<UsbDeviceLike>;
  getDevices?: () => Promise<UsbDeviceLike[]>;
};

const getNavigatorUsb = (): UsbLike | null => {
  if (typeof navigator === "undefined") {
    return null;
  }
  const maybeUsb = (navigator as Navigator & { usb?: UsbLike }).usb;
  return maybeUsb ?? null;
};

export class EscPosUsbPrinter {
  private device: UsbDeviceLike | null = null;
  private endpointOut: number | null = null;
  private interfaceNumber: number | null = null;

  static isSupported() {
    return getNavigatorUsb() !== null;
  }

  private async prepareDevice(requestedDevice: UsbDeviceLike) {
    await requestedDevice.open();

    if (requestedDevice.configuration === null) {
      await requestedDevice.selectConfiguration(1);
    }

    const configuration = requestedDevice.configuration;
    if (!configuration) {
      throw new Error("Configuration USB introuvable.");
    }

    let foundInterfaceNumber: number | null = null;
    let foundEndpointOut: number | null = null;

    for (const iface of configuration.interfaces) {
      for (const alternate of iface.alternates) {
        const endpoint = alternate.endpoints.find((entry) => entry.direction === "out");
        if (endpoint) {
          foundInterfaceNumber = iface.interfaceNumber;
          foundEndpointOut = endpoint.endpointNumber;
          break;
        }
      }
      if (foundInterfaceNumber !== null) {
        break;
      }
    }

    if (foundInterfaceNumber === null || foundEndpointOut === null) {
      await requestedDevice.close();
      throw new Error("Aucun endpoint USB de sortie detecte pour l'imprimante.");
    }

    await requestedDevice.claimInterface(foundInterfaceNumber);

    this.device = requestedDevice;
    this.interfaceNumber = foundInterfaceNumber;
    this.endpointOut = foundEndpointOut;
  }

  async connect() {
    if (!EscPosUsbPrinter.isSupported()) {
      throw new Error("WebUSB non supporte par ce navigateur.");
    }

    const usb = getNavigatorUsb();
    if (!usb) {
      throw new Error("WebUSB non supporte par ce navigateur.");
    }

    const requestedDevice = await usb.requestDevice({
      filters: [],
    });
    await this.prepareDevice(requestedDevice);
  }

  async reconnectKnownDevice() {
    const usb = getNavigatorUsb();
    if (!usb?.getDevices) {
      return false;
    }
    const knownDevices = await usb.getDevices();
    const first = knownDevices[0];
    if (!first) {
      return false;
    }
    await this.prepareDevice(first);
    return true;
  }

  async ensureConnected() {
    if (!this.device || !this.device.opened || this.endpointOut === null) {
      await this.connect();
    }
  }

  async print(data: Uint8Array) {
    await this.ensureConnected();
    if (!this.device || this.endpointOut === null) {
      throw new Error("Imprimante non connectee.");
    }

    const payload = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) as ArrayBuffer;
    await this.device.transferOut(this.endpointOut, payload);
  }

  async disconnect() {
    if (!this.device) {
      return;
    }

    if (this.interfaceNumber !== null) {
      try {
        await this.device.releaseInterface(this.interfaceNumber);
      } catch {
        // no-op
      }
    }

    if (this.device.opened) {
      await this.device.close();
    }

    this.device = null;
    this.endpointOut = null;
    this.interfaceNumber = null;
  }
}

export const escPosUsbPrinter = new EscPosUsbPrinter();
