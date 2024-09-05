"use client";
import React, { useState } from "react";
import parities from "../../utils/parties";
import paritiesEncrypted from "../../utils/paritiesEncrypted";

export default function UploadCostCalc() {
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<{ name: string; value: string }[]>([]);
  const [dataSize, setDataSize] = useState("");
  const [redundancy, setRedundancy] = useState("");
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [unit, setUnit] = useState("chunks");
  const maxChunks = [119, 107, 97, 37];
  const maxParities = [9, 21, 31, 89];
  const maxChunksEncrypted = [59, 53, 48, 18];
  const errorTolerances: Record<string, string> = {
    Medium: "1%",
    Strong: "5%",
    Insane: "10%",
    Paranoid: "50%",
  };

  const formatNumberCustom = (num: number | undefined = 0) => {
    const isScientific = Math.abs(num) > 0 && Math.abs(num) < 0.0001;
    let formattedNum = isScientific ? num.toExponential(2) : num.toFixed(2);

    return formattedNum;
  };

  const handleDataSizeChange = (e: {
    target: { value: React.SetStateAction<string> };
  }) => {
    setDataSize(e.target.value);
  };

  const handleRedundancyChange = (e: {
    target: { value: React.SetStateAction<string> };
  }) => {
    setRedundancy(e.target.value);
  };

  const handleEncryptionChange = () => {
    setIsEncrypted(!isEncrypted);
  };

  const handleUnitChange = (e: {
    target: { value: React.SetStateAction<string> };
  }) => {
    setUnit(e.target.value);
  };

  const calculateCost = () => {
    setErrorMessage("");
    setResult([]);

    if (!redundancy) {
      setErrorMessage("Please select a redundancy level.");
      return;
    }

    let totalChunks, sizeInKb, sizeInGb, parityDataInGb;
    if (unit === "kb") {
      const kbValue = parseFloat(dataSize);
      if (isNaN(kbValue) || kbValue <= 0) {
        setErrorMessage("Please input a valid KB value above 0.");
        return;
      }
      sizeInKb = kbValue;
      totalChunks = Math.ceil((kbValue * 1024) / 2 ** 12);
    } else if (unit === "gb") {
      const gbValue = parseFloat(dataSize);
      if (isNaN(gbValue) || gbValue <= 0) {
        setErrorMessage("Please input a valid GB value above 0.");
        return;
      }
      sizeInGb = gbValue;
      sizeInKb = gbValue * 1024 * 1024; // Convert GB to KB
      totalChunks = Math.ceil((sizeInKb * 1024) / 2 ** 12);
    } else {
      const chunksValue = parseFloat(dataSize);
      if (isNaN(chunksValue) || chunksValue <= 1 || chunksValue % 1 > 0) {
        setErrorMessage(
          "Please input an integer greater than 1 for chunk values"
        );
        return;
      }
      totalChunks = Math.ceil(chunksValue);
      sizeInKb = (totalChunks * 2 ** 12) / 1024;
    }

    const redundancyLevels: Record<string, number> = {
      Medium: 0,
      Strong: 1,
      Insane: 2,
      Paranoid: 3,
    };
    const redundancyLevel = redundancyLevels[redundancy];

    const quotient = isEncrypted
      ? Math.floor(totalChunks / maxChunksEncrypted[redundancyLevel])
      : Math.floor(totalChunks / maxChunks[redundancyLevel]);
    const remainder = isEncrypted
      ? totalChunks % maxChunksEncrypted[redundancyLevel]
      : totalChunks % maxChunks[redundancyLevel];
    const remainderIndex = remainder - 1 < 0 ? 0 : remainder - 1;
    const selectedParities = isEncrypted ? paritiesEncrypted : parities;
    const remainderParities =
      selectedParities[redundancyLevel][remainderIndex] || 0;
    const totalParities =
      quotient * maxParities[redundancyLevel] + remainderParities;
    const totalDataWithParity = totalChunks + totalParities;
    const percentDifference =
      ((totalDataWithParity - totalChunks) / totalChunks) * 100;
    const parityDataInKb = (totalParities * 2 ** 12) / 1024;

    // Convert parity data size to GB if input unit is GB
    if (unit === "gb") {
      parityDataInGb = parityDataInKb / (1024 * 1024); // Convert KB to GB
    }

    const formatNumber = (num: string | number | bigint) =>
      new Intl.NumberFormat("en-US").format(Number(num));

    const resultsArray = [
      {
        name: "Source data size",
        value:
          unit === "gb"
            ? `${formatNumberCustom(sizeInGb)} GB`
            : `${formatNumberCustom(sizeInKb)} KB`,
      },
      {
        name: "Parity data size",
        value:
          unit === "gb"
            ? `${formatNumberCustom(parityDataInGb)} GB`
            : `${formatNumberCustom(parityDataInKb)} KB`,
      },
      {
        name: "Source data in chunks",
        value: formatNumber(totalChunks),
      },
      {
        name: "Additional parity chunks",
        value: formatNumber(totalParities),
      },
      {
        name: "Percent cost increase",
        value: `${percentDifference.toFixed(2)}%`,
      },
      {
        name: "Selected redundancy level",
        value: `${redundancy}`,
      },
      {
        name: "Error tolerance",
        value: errorTolerances[redundancy],
      },
    ];

    setResult(resultsArray);
  };

  const styles = {
    container: {
      padding: "20px",
      fontFamily: "Arial",
      maxWidth: "650px",
      margin: "0 auto",
    },
    title: { margin: "10px 0" },
    input: { padding: "8px", margin: "5px 0", width: "50%" },
    select: { padding: "8px", margin: "5px 0", width: "50%" },
    button: { padding: "10px 15px", margin: "10px 0", cursor: "pointer" },
    result: { margin: "10px 0", fontWeight: "bold" },
    table: {
      width: "100%",
      borderCollapse: "collapse",
    },
    tdName: {
      border: "1px solid #ccc",
      padding: "4px 8px",
      textAlign: "left",
    },
    tdValue: {
      border: "1px solid #ccc",
      padding: "4px 8px",
      textAlign: "right",
    },
    bold: {
      fontWeight: "bold",
    },
  };

  return (
    <div style={styles.container}>
      <div className="text-white">
        <div style={styles.title}>Data Size:</div>
        <input
          placeholder="Enter data size"
          type="number"
          value={dataSize}
          onChange={handleDataSizeChange}
          className="text-black p-2 rounded-xl"
        />
        <div style={styles.title}>Data Unit:</div>
        <select
          value={unit}
          onChange={handleUnitChange}
          className="text-black p-2 rounded-xl"
        >
          <option value="chunks" className="text-black">
            Chunks
          </option>
          <option value="kb" className="text-black">
            KB
          </option>
          <option value="gb" className="text-black">
            GB
          </option>
        </select>
        <div style={styles.title}>Redundancy Level:</div>
        <select
          value={redundancy}
          onChange={handleRedundancyChange}
          style={styles.select}
          className="text-black p-2 rounded-xl"
        >
          <option value="" disabled>
            Select Redundancy Level
          </option>
          <option value="Medium">Medium</option>
          <option value="Strong">Strong</option>
          <option value="Insane">Insane</option>
          <option value="Paranoid">Paranoid</option>
        </select>
        <div style={styles.title}>
          <input
            type="checkbox"
            checked={isEncrypted}
            onChange={handleEncryptionChange}
          />{" "}
          Use Encryption?
        </div>
        {errorMessage && (
          <div style={{ color: "red", marginTop: "10px" }}>{errorMessage}</div>
        )}
        <button
          onClick={calculateCost}
          className="p-4 bg-white text-black rounded-xl"
        >
          Calculate
        </button>
      </div>
      <div style={styles.result}>
        <table>
          <tbody className="text-white">
            {result.map((item, index) => (
              <tr key={index} className="text-white">
                <td className="text-white">{item.name}</td>
                {/* Apply bold style here */}
                <td className="text-white">{item.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
