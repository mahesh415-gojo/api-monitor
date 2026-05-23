import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function App() {
  const [logs, setLogs] = useState([]);
  const [selectedApi, setSelectedApi] = useState(null);

  const [apiInput, setApiInput] = useState("");

  // Default APIs
  const defaultApis = [
    {
      apiName: "GitHub API",
      url: "https://api.github.com",
    },
    {
      apiName: "JSONPlaceholder",
      url: "https://jsonplaceholder.typicode.com/posts",
    },
  ];

  useEffect(() => {
    fetchLogs();

    // Load default APIs only once
    loadDefaultApis();

    const interval = setInterval(() => {
      fetchLogs();
    }, 5000);

    return () => clearInterval(interval);

  }, []);

  const fetchLogs = async () => {
    try {
      const res = await axios.get(
        "http://localhost:3000/logs"
      );

      setLogs((prevLogs) => {
        const merged = [...prevLogs];

        res.data.forEach((newLog) => {
          const exists = merged.find(
            (item) =>
              item.apiName === newLog.apiName &&
              item.checkedAt === newLog.checkedAt
          );

          if (!exists) {
            merged.push(newLog);
          }
        });

        return merged;
      });

    } catch (err) {
      console.log(err);
    }
  };

  const loadDefaultApis = async () => {

    for (const api of defaultApis) {

      const exists = logs.find(
        (item) =>
          item.apiName === api.apiName
      );

      if (exists) continue;

      try {

        const start = Date.now();

        const response =
          await axios.get(api.url);

        const responseTime =
          Date.now() - start;

        const newLog = {
          _id: Date.now() + Math.random(),
          apiName: api.apiName,
          statusCode: response.status,
          responseTime,
          checkedAt: new Date(),
        };

        setLogs((prev) => [
          ...prev,
          newLog,
        ]);

      } catch {
        console.log("API failed");
      }
    }
  };

  const addApi = async () => {

    if (!apiInput) return;

    const alreadyExists =
      logs.find(
        (item) =>
          item.apiName.toLowerCase() ===
          apiInput.toLowerCase()
      );

    if (alreadyExists) {
      alert("API already exists");
      return;
    }

    try {

      const start = Date.now();

      const response =
        await axios.get(apiInput);

      const responseTime =
        Date.now() - start;

      const newLog = {
        _id: Date.now(),
        apiName: apiInput,
        statusCode: response.status,
        responseTime,
        checkedAt: new Date(),
      };

      setLogs((prev) => [
        newLog,
        ...prev,
      ]);

    } catch {

      const failedLog = {
        _id: Date.now(),
        apiName: apiInput,
        statusCode: 500,
        responseTime: 0,
        checkedAt: new Date(),
      };

      setLogs((prev) => [
        failedLog,
        ...prev,
      ]);
    }

    setApiInput("");
  };

  const uniqueApis=[];

  const apiCards =
    logs.filter((log)=>{

      if(
        !uniqueApis.includes(
          log.apiName
        )
      ){
        uniqueApis.push(
          log.apiName
        );

        return true;
      }

      return false;
    });

  const filteredLogs =
    selectedApi
    ?
    logs.filter(
      (log)=>
      log.apiName===
      selectedApi
    )
    :
    [];

  return (

<div className="container">

<h1>
🚀 Professional API Monitor
</h1>

<div className="top-bar">

<input
type="text"
placeholder="Enter API URL..."
value={apiInput}
onChange={(e)=>
setApiInput(
e.target.value
)}
className="search-box"
/>

<button
onClick={addApi}
className="add-btn"
>
Monitor API
</button>

</div>

<div className="grid">

{apiCards.map((log)=>(

<div
key={log._id}
className={`card ${
log.statusCode===200
?
"success"
:
"failed"
}`}
onClick={()=>
setSelectedApi(
log.apiName
)
}
>

<h2>
{log.apiName}
</h2>

<p>
Status:
{" "}
{log.statusCode}
</p>

<p>
Response:
{" "}
{log.responseTime}
ms
</p>

<p>
{
new Date(
log.checkedAt
)
.toLocaleString()
}
</p>

</div>

))}

</div>

{
selectedApi && (

<div
className=
"chart-container"
>

<h2>
{selectedApi}
Analytics
</h2>

<ResponsiveContainer
width="100%"
height={400}
>

<LineChart
data=
{filteredLogs}
>

<CartesianGrid
strokeDasharray=
"3 3"
/>

<XAxis
dataKey=
"checkedAt"
tickFormatter=
{(time)=>

new Date(
time
)
.toLocaleTimeString()
}
/>

<YAxis/>

<Tooltip/>

<Line
type=
"monotone"
dataKey=
"responseTime"
stroke=
"#00ff99"
strokeWidth=
{3}
/>

</LineChart>

</ResponsiveContainer>

</div>

)}

</div>

);

}

export default App;