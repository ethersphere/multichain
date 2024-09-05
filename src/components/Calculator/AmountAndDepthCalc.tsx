"use client";
import { useBzz } from "@/context/Bzz";
import React, { useState, useEffect } from "react";

function FetchPriceComponent() {
  const [price, setPrice] = useState<any>(null);
  const [time, setTime] = useState("");
  const [timeUnit, setTimeUnit] = useState("hours");
  const [volume, setVolume] = useState("");
  const [volumeUnit, setVolumeUnit] = useState("GB");
  const [convertedTime, setConvertedTime] = useState<number | null>(null);
  const [minimumDepth, setMinimumDepth] = useState<number | null>(0);
  const [depth, setDepth] = useState<number | null | "No suitable depth found">(
    null
  );

  const { bzzAmount, setBzzAmount } = useBzz();

  const [amount, setAmount] = useState<number | null>(null);
  const [storageCost, setStorageCost] = useState("");
  const [minimumDepthStorageCost, setMinimumDepthStorageCost] = useState<
    string | null
  >(null);
  const [showResults, setShowResults] = useState(false);
  const [timeError, setTimeError] = useState("");
  const [volumeError, setVolumeError] = useState("");

  useEffect(() => {
    setBzzAmount(storageCost);
    console.log(bzzAmount, "bzzAmount");
  }, [storageCost, amount, setBzzAmount, bzzAmount]);
  // Volume in GB
  const volumeToDepth: { [key: string]: number } = {
    "4.93": 22,
    "17.03": 23,
    "44.21": 24,
    "102.78": 25,
    "225.86": 26,
    "480.43": 27,
    "1024.00": 28,
    "2109.44": 29,
    "4300.80": 30,
    "8724.48": 31,
    "17612.80": 32,
    "35461.12": 33,
    "71249.92": 34,
    "142981.12": 35,
    "286627.84": 36,
    "574187.52": 37,
    "1174405.12": 38,
    "2359296.00": 39,
    "4718592.00": 40,
    "9437184.00": 41,
  };

  const depthToVolume = {
    22: "4.93 GB",
    23: "17.03 GB",
    24: "44.21 GB",
    25: "102.78 GB",
    26: "225.86 GB",
    27: "480.43 GB",
    28: "1.00 TB",
    29: "2.06 TB",
    30: "4.20 TB",
    31: "8.52 TB",
    32: "17.20 TB",
    33: "34.63 TB",
    34: "69.58 TB",
    35: "139.63 TB",
    36: "279.91 TB",
    37: "560.73 TB",
    38: "1.12 PB",
    39: "2.25 PB",
    40: "4.50 PB",
    41: "9.00 PB",
  };

  useEffect(() => {
    fetchPrice();
  }, []);

  useEffect(() => {
    if (depth !== null && amount !== null) {
      calculateStorageCost();
    }
    if (minimumDepth !== null && amount !== null) {
      calculateMinimumDepthStorageCost();
    }
  }, [depth, amount, minimumDepth]);

  const fetchPrice = async () => {
    try {
      const response = await fetch(
        "https://api.swarmscan.io/v1/events/storage-price-oracle/price-update"
      );
      if (!response.ok) throw new Error("Network response was not ok");
      const data = await response.json();
      if (data.events && data.events.length > 0) {
        setPrice(parseFloat(data.events[0].data.price));
      } else {
        console.error("No price update available.");
      }
    } catch (error: any) {
      console.error("Error fetching price:", error?.message);
    }
  };

  const handleCalculate = () => {
    if (!price) {
      console.error("Price data not available");
      return;
    }

    setShowResults(false);
    setTimeError("");
    setVolumeError("");

    const hours = convertTimeToHours(time, timeUnit);
    const gigabytes = convertVolumeToGB(volume, volumeUnit);

    if (!hours || !gigabytes) return;

    setConvertedTime(hours);
    calculateDepth(gigabytes);
    setMinimumDepth(calculateMinimumDepth(gigabytes));
    calculateAmount((hours * 3600) / 5);
    setShowResults(true);
    setBzzAmount(storageCost as string);
    console.log(bzzAmount, "bzzAmount");
  };
  const calculateDepth = (gigabytes: number) => {
    const keys = Object.keys(volumeToDepth)
      .map((key) => parseFloat(key))
      .sort((a, b) => a - b);
    let foundKey = keys.find((key) => key >= gigabytes);
    setDepth(
      foundKey ? volumeToDepth[foundKey.toFixed(2)] : "No suitable depth found"
    );
  };

  const calculateMinimumDepth = (gigabytes: number) => {
    for (let depth = 17; depth <= 41; depth++) {
      if (gigabytes <= Math.pow(2, 12 + depth) / 1024 ** 3) {
        return depth;
      }
    }
    return null;
  };

  const calculateAmount = (blocks: number) => {
    if (price !== null) {
      const totalAmount = blocks * price;
      setAmount(totalAmount);
    }
  };

  const calculateStorageCost = () => {
    if (depth !== null && amount !== null) {
      const cost = (2 ** (depth as number) * (amount as number)) / 1e16;
      setStorageCost(cost.toFixed(4));
    }
  };

  const calculateMinimumDepthStorageCost = () => {
    if (minimumDepth !== null && amount !== null) {
      const cost = (2 ** minimumDepth * amount) / 1e16;
      setMinimumDepthStorageCost(cost.toFixed(4));
    }
  };

  const convertTimeToHours = (time: string, unit: string) => {
    const num = parseFloat(time);
    if (isNaN(num) || num <= 0) {
      setTimeError("Time must be a positive number greater than 24 hrs.");
      return 0;
    }
    const hours =
      num *
      (unit === "years"
        ? 8760
        : unit === "weeks"
        ? 168
        : unit === "days"
        ? 24
        : 1);
    if (hours < 24) {
      setTimeError("Time must be longer than 24 hours.");
      return 0;
    }
    return hours;
  };

  const convertVolumeToGB = (volume: string, unit: string) => {
    const num = parseFloat(volume);
    if (isNaN(num) || num <= 0) {
      setVolumeError("Volume must be a positive number.");
      return 0;
    }
    const gigabytes =
      num *
      (unit === "TB"
        ? 1024
        : unit === "PB"
        ? 1048576
        : unit === "MB"
        ? 1 / 1024
        : 1);
    if (gigabytes <= 0 || gigabytes > 9437184) {
      setVolumeError("Volume must be greater than 0 and less than 9 PB.");
      return 0;
    }
    return gigabytes;
  };

  return (
    <div style={{ alignItems: "flex-start", width: "auto" }}>
      <div>
        <label
          htmlFor="timeInput"
          style={{ display: "block", marginBottom: "5px" }}
        >
          Time:
        </label>
        <input
          id="timeInput"
          style={{
            marginRight: "5px",
            padding: "8px",
            borderRadius: "8px",
            color: "black",
          }}
          value={time}
          onChange={(e) => setTime(e.target.value)}
          placeholder="Enter time (>= 24 hrs)"
        />
        <select
          style={{
            marginRight: "5px",
            padding: "8px",
            color: "black",
            borderRadius: "8px",
          }}
          value={timeUnit}
          onChange={(e) => setTimeUnit(e.target.value)}
        >
          <option value="hours">Hours</option>
          <option value="days">Days</option>
          <option value="weeks">Weeks</option>
          <option value="years">Years</option>
        </select>
        {timeError && (
          <p style={{ color: "red", marginBottom: "10px" }}>{timeError}</p>
        )}
      </div>
      <div style={{ marginBottom: "5px" }}>
        <label
          htmlFor="volumeInput"
          style={{ display: "block", marginBottom: "5px" }}
        >
          Volume:
        </label>
        <input
          id="volumeInput"
          style={{
            marginRight: "5px",
            padding: "8px",
            color: "black",
            borderRadius: "8px",
          }}
          value={volume}
          onChange={(e) => setVolume(e.target.value)}
          placeholder="Enter volume (<= 9 PB)"
        />
        <select
          style={{
            marginRight: "5px",
            padding: "8px",
            color: "black",
            borderRadius: "8px",
          }}
          value={volumeUnit}
          onChange={(e) => setVolumeUnit(e.target.value)}
        >
          <option value="MB">Megabytes</option>
          <option value="GB">Gigabytes</option>
          <option value="TB">Terabytes</option>
          <option value="PB">Petabytes</option>
        </select>

        {volumeError && (
          <p style={{ color: "red", marginBottom: "10px" }}>{volumeError}</p>
        )}
      </div>
      <div>
        <button
          style={{
            padding: "10px 15px",
            cursor: "pointer",
            display: "inline-block",
            width: "auto",
          }}
          className="p-4 bg-white text-black rounded-xl"
          onClick={handleCalculate}
        >
          Calculate
        </button>
      </div>

      {showResults && !timeError && !volumeError && (
        <div className="text-white">
          {/* <div style={{ marginTop: "20px", fontSize: "16px" }}>
            {`In order to store ${volume} ${volumeUnit} of data for ${time} ${timeUnit}, a depth of ${depth} and an amount value of ${amount} should be used.`}
          </div> */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: "20px",
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    padding: "8px",
                    border: "1px solid",
                  }}
                >
                  Field
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "8px",
                    border: "1px solid",
                  }}
                >
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Time</td>
                <td>{convertedTime} hours</td>
              </tr>
              <tr>
                <td>Volume</td>
                <td>{`${volume} ${volumeUnit}`}</td>
              </tr>
              {/* <tr>
                <td>Suggested Minimum Amount</td>
                <td>{amount} PLUR</td>
              </tr>
              <tr>
                <td>Suggested Safe Depth</td>
                <td>
                  {depth !== null && (
                    <>
                      {`${depth} (for an `}
                      <a href="/docs/learn/technology/contracts/postage-stamp#effective-utilisation-table">
                        effective volume
                      </a>
                      {` of ${
                        depthToVolume[depth as keyof typeof depthToVolume]
                      })`}
                    </>
                  )}
                </td>
              </tr> */}
              {/* <tr>
                <td>Suggested Minimum Depth</td>
                <td>
                  {minimumDepth} (see{" "}
                  <a href="/docs/learn/technology/contracts/postage-stamp#effective-utilisation-table">
                    batch utilisation
                  </a>{" "}
                  - may require <a href="#dilute-your-batch">dilution</a>)
                </td>
              </tr> */}
              <tr>
                <td className="">Batch Cost for Safe Depth</td>
                <td>{storageCost} xBZZ</td>
              </tr>
              {/* <tr>
                <td>Batch Cost for Minimum Depth</td>
                <td>{minimumDepthStorageCost} xBZZ</td>
              </tr> */}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default FetchPriceComponent;