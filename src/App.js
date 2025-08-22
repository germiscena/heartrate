import { parseArrayData } from "./utils";
import { useEffect, useRef, useState } from "react";
import ViewDefault from "./defaultECG/viewDefault";
import { graphData } from "./allData/data";
import { newData } from "./allData/newData";
import ViewATN from "./ATNAlgorithm/viewATN";
import ViewPT from "./PTAlgorithm/viewPT";
import ViewKHO from "./KHOAlgorithm/viewKHO";
import { peaksCollection, saveFile } from "./peaksCollection/peaksCollection";
import { PAGE_SIZE, readUploadedFile, streamUploadedFileData } from "./fileReader/fileReader";

function App() {
  const [currentView, setCurrentView] = useState(null);
  const [currentData, setCurrentData] = useState(null);
  const [series, setSeries] = useState(null);

  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedSeries, setUploadedSeries] = useState(null);
  const [uploadedSeriesFirstRow, setUploadedSeriesFirstRow] = useState(null);
  const [uploadedSeriesLength, setUploadedSeriesLength] = useState({ length: 0, pages: 0 });
  const [uploadedSeriesPage, setUploadedSeriesPage] = useState(0);

  const inputRef = useRef(null);

  const getFullFileData = async () => {
    const data = await getStreamData(0, uploadedSeriesLength.length, true).then((res) => {
      return parseArrayData(readUploadedFile(res.lines, true));
    });
    return data;
  };

  const getStreamData = async (startLine, count, isFirst) => {
    const data = await streamUploadedFileData(uploadedFile, startLine, count, isFirst);
    return data;
  };

  useEffect(() => {
    if (currentData === 0) {
      setSeries(parseArrayData(graphData));
    } else if (currentData === 1) {
      setSeries(parseArrayData(newData));
    } else if (currentData === 2) {
      setSeries(uploadedSeries);
    }
  }, [currentData, uploadedSeries]);

  useEffect(() => {
    if (!!uploadedSeriesLength.length) {
      getStreamData(
        PAGE_SIZE * uploadedSeriesPage,
        PAGE_SIZE,
        uploadedSeriesLength.length === 0
      ).then((res) => {
        setUploadedSeries(
          parseArrayData(
            [uploadedSeriesFirstRow].concat(
              readUploadedFile(res.lines, uploadedSeriesLength.length === 0)
            )
          )
        );
      });
    }
  }, [uploadedSeriesPage]);

  const changeCurrentView = (id) => {
    currentView !== id && setCurrentView(id);
    uploadedSeriesPage !== 0 && setUploadedSeriesPage(0);
  };

  const changeCurrentData = (id) => {
    currentData !== id && setCurrentData(id);
  };

  const clearUploadedFileData = () => {
    setUploadedFile(null);
    setUploadedSeries(null);
    setUploadedSeriesFirstRow(null);
    setUploadedSeriesLength({ length: 0, pages: 0 });
    setUploadedSeriesPage(0);
  };

  const onUploadingFile = (e) => {
    const file = e.target.files[0];
    if (!file) {
      alert("произошла ошибка, попробуйте снова");
    }
    clearUploadedFileData();
    const reader = new FileReader();
    reader.onload = async (e) => {
      setUploadedFile(file);
      if (inputRef) {
        inputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const showUploadedFile = async () => {
    const streamData = await streamUploadedFileData(
      uploadedFile,
      PAGE_SIZE * uploadedSeriesPage,
      PAGE_SIZE,
      uploadedSeriesLength.length === 0
    );

    !uploadedSeriesLength.length &&
      setUploadedSeriesLength({
        length: streamData.totalLines - 1,
        pages: (streamData.totalLines - 1) / PAGE_SIZE,
      });
    const currentStreamData = readUploadedFile(streamData.lines, true);
    setUploadedSeriesFirstRow(currentStreamData[0]);
    setUploadedSeries(parseArrayData(currentStreamData));
    changeCurrentData(2);
  };

  const getPeaksData = async () => {
    const currentSeries = currentData === 2 ? await getFullFileData() : series;
    saveFile(peaksCollection(currentSeries));
  };

  const activeStyle = {
    background: "black",
    color: "white",
  };

  const blockedStyle = {
    color: "darkgray",
    background: "gray",
    pointerEvents: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          width: "80%",
        }}
      >
        <div>
          <button style={currentView === 0 ? activeStyle : {}} onClick={() => changeCurrentView(0)}>
            Стандартный вид (3 канала)
          </button>
          <button style={currentView === 1 ? activeStyle : {}} onClick={() => changeCurrentView(1)}>
            Алгоритм PT
          </button>
          <button style={currentView === 2 ? activeStyle : {}} onClick={() => changeCurrentView(2)}>
            Алгоритм KHO
          </button>
          {/* <button style={currentView === 3 ? activeStyle : {}} onClick={() => changeCurrentView(3)}>
            Алгоритм KHO(2)
          </button> */}
          <button style={currentView === 3 ? activeStyle : {}} onClick={() => changeCurrentView(3)}>
            Алгоритм ATN
          </button>
          {uploadedSeriesLength.length !== 0 && (
            <div>
              <button
                style={uploadedSeriesPage === 0 ? blockedStyle : {}}
                onClick={() => setUploadedSeriesPage(uploadedSeriesPage - 1)}
              >
                Предыдущая страница
              </button>
              <button
                style={uploadedSeriesPage === uploadedSeriesLength.pages - 1 ? blockedStyle : {}}
                onClick={() => setUploadedSeriesPage(uploadedSeriesPage + 1)}
              >
                Следующая страница
              </button>
            </div>
          )}
        </div>
        <div>
          <button style={currentData === 0 ? activeStyle : {}} onClick={() => changeCurrentData(0)}>
            Файл 1
          </button>
          <button style={currentData === 1 ? activeStyle : {}} onClick={() => changeCurrentData(1)}>
            Файл 2
          </button>
          {uploadedFile !== null && (
            <button style={currentData === 2 ? activeStyle : {}} onClick={() => showUploadedFile()}>
              Загруженный файл
            </button>
          )}
          <button>
            <label htmlFor="fileUpload">Загрузить файл</label>
            <input
              key={uploadedSeries?.title}
              type="file"
              id="fileUpload"
              onChange={onUploadingFile}
              ref={inputRef}
              accept=".txt"
              hidden
            />
          </button>
          <button
            style={{ marginLeft: "10px", ...(currentData === null ? blockedStyle : activeStyle) }}
            onClick={getPeaksData}
          >
            Сохранить результат
          </button>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "row" }}>
        {currentData === null || currentView === null || series === null ? (
          "Выберите файл для построения графиков"
        ) : currentView === 0 ? (
          <ViewDefault series={series} uploadedSeriesPage={uploadedSeriesPage} />
        ) : currentView === 1 ? (
          <ViewPT series={series} uploadedSeriesPage={uploadedSeriesPage} />
        ) : currentView === 2 ? (
          <ViewKHO series={series} uploadedSeriesPage={uploadedSeriesPage} />
        ) : (
          <ViewATN series={series} uploadedSeriesPage={uploadedSeriesPage} />
        )}
      </div>
    </div>
  );
}

export default App;
