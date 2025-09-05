import { parseArrayData, saveFile } from './utils';
import { useEffect, useRef, useState } from 'react';
import ViewDefault from './defaultECG/viewDefault';
import { graphData } from './allData/data';
import { newData } from './allData/newData';
import ViewATN from './ATNAlgorithm/viewATN';
import ViewPT from './PTAlgorithm/viewPT';
import ViewKHO from './KHOAlgorithm/viewKHO';
import {
  peaksCollection,
  peaksCollectionCompareWithTraces,
  peaksCollectionCompareWithTracesSingle,
} from './peaksCollection/peaksCollection';
import { PAGE_SIZE, readUploadedFile, streamUploadedFileData } from './fileReader/fileReader';
import ViewCMD from './CMDAlgorithm/viewCMD';
import ViewGPT from './GPTAlgorithm/viewGPT';
import { preprocessSignal } from './preprocessSignal/preprocessSignal';

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
        uploadedSeriesLength.length === 0,
      ).then((res) => {
        setUploadedSeries(
          parseArrayData(
            [uploadedSeriesFirstRow].concat(
              readUploadedFile(res.lines, uploadedSeriesLength.length === 0),
            ),
          ),
        );
      });
    }
  }, [uploadedSeriesPage]);

  const changeCurrentView = (id) => {
    currentView !== id && setCurrentView(id);
    uploadedSeriesPage !== 0 && setUploadedSeriesPage(0);
  };

  const changeCurrentData = (id) => {
    id !== currentData && setCurrentData(id);
    if (uploadedSeriesPage !== 0) {
      setUploadedSeriesPage(0);
    }
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
      alert('произошла ошибка, попробуйте снова');
    }
    clearUploadedFileData();
    const reader = new FileReader();
    reader.onload = async (e) => {
      setUploadedFile(file);
      if (inputRef) {
        inputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const showUploadedFile = async () => {
    const streamData = await streamUploadedFileData(
      uploadedFile,
      PAGE_SIZE * uploadedSeriesPage,
      PAGE_SIZE,
      uploadedSeriesLength.length === 0,
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

  const getPeaks = async (type) => {
    const currentSeries = currentData === 2 ? await getFullFileData() : series;
    let peaks;
    if (type === 'ideal') {
      peaks = await peaksCollectionCompareWithTracesSingle(series);
    } else if (type === 'all') {
      peaks = await peaksCollection(currentSeries);
    } else if (type === 'compare') {
      const peaks1 = await peaksCollectionCompareWithTraces(
        series,
        [{ data: preprocessSignal(series).savGolayFilteredMLC }],
        [{ data: preprocessSignal(series).notchFilteredML }],
        [{ data: preprocessSignal(series).biggestPreprocess.bp }],
      );
      const peaks2 = await peaksCollectionCompareWithTraces(
        series.slice(1),
        [{ data: preprocessSignal(series.slice(1)).savGolayFilteredMLC }],
        [{ data: preprocessSignal(series.slice(1)).notchFilteredML }],
        [{ data: preprocessSignal(series.slice(1)).biggestPreprocess.bp }],
      );
      const peaks3 = await peaksCollectionCompareWithTraces(
        series.slice(2),
        [{ data: preprocessSignal(series.slice(1)).savGolayFilteredMLC }],
        [{ data: preprocessSignal(series.slice(1)).notchFilteredML }],
        [{ data: preprocessSignal(series.slice(1)).biggestPreprocess.bp }],
      );
      const filler = Array(peaks1[0].length).fill('-');
      peaks = peaks1.concat(
        [filler],
        [filler],
        [filler],
        peaks2,
        [filler],
        [filler],
        [filler],
        peaks3,
      );
    }
    return peaks;
  };

  const getPeaksData = async (type) => {
    const peaks = await getPeaks(type);
    saveFile(peaks);
  };

  const activeStyle = {
    background: 'black',
    color: 'white',
  };

  const blockedStyle = {
    color: 'darkgray',
    background: 'gray',
    pointerEvents: 'none',
  };

  const allViewButtons = [
    { name: 'Стандартный вид (3 канала)', view: 0 },
    { name: 'Алгоритм PT', view: 1 },
    { name: ' Алгоритм KHO', view: 2 },
    { name: ' Алгоритм ATN', view: 3 },
    { name: ' Алгоритм CMD(1)', view: 4 },
    { name: 'Алгоритм CMD(2)', view: 5 },
    { name: ' Алгоритм GPT', view: 7 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        <div>
          {allViewButtons.map((item) => {
            return (
              <button
                key={item.view}
                style={currentView === item.view ? activeStyle : {}}
                onClick={() => changeCurrentView(item.view)}
              >
                {item.name}
              </button>
            );
          })}

          {uploadedSeriesLength.length !== 0 && currentData === 2 && (
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
            style={{ marginLeft: '10px', ...(currentData === null ? blockedStyle : activeStyle) }}
            onClick={() => getPeaksData('all')}
          >
            Сохранить результат
          </button>
          <button
            style={{ marginLeft: '10px', ...(currentData === null ? blockedStyle : activeStyle) }}
            onClick={() => getPeaksData('ideal')}
          >
            Сохранить результат с идеальным файлом traces
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        {currentView === null || series === null ? (
          'Выберите файл для построения графиков'
        ) : currentView === 0 ? (
          <ViewDefault series={series} uploadedSeriesPage={uploadedSeriesPage} />
        ) : currentView === 1 ? (
          <ViewPT series={series} uploadedSeriesPage={uploadedSeriesPage} />
        ) : currentView === 2 ? (
          <ViewKHO series={series} uploadedSeriesPage={uploadedSeriesPage} />
        ) : currentView === 3 ? (
          <ViewATN series={series} uploadedSeriesPage={uploadedSeriesPage} />
        ) : currentView === 4 ? (
          <ViewCMD series={series} uploadedSeriesPage={uploadedSeriesPage} type={1} />
        ) : currentView === 5 ? (
          <ViewCMD series={series} uploadedSeriesPage={uploadedSeriesPage} type={2} />
        ) : currentView === 7 ? (
          <ViewGPT series={series} uploadedSeriesPage={uploadedSeriesPage} />
        ) : null}
      </div>
    </div>
  );
}

export default App;
