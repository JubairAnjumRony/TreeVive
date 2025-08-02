import { Helmet } from "react-helmet-async";
import AddPlantForm from "../../../components/Form/AddPlantForm";
import { imageUpload } from "../../../api/utils";
import useAuth from "../../../hooks/useAuth";
import { useState } from "react";
import useAxiosSecure from "../../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const AddPlant = () => {
  const { user } = useAuth();
  const [uploadButtonText, setUploadButtonText] = useState({image:{name:'upload image'}});
  const [loading, setLoading] = useState(false);
  const axiosSecure = useAxiosSecure();
  const navigate  = useNavigate();

  const handleSubmit = async (e) => {
    setLoading(true);
    e.preventDefault();
    const form = e.target;
    const name = form.name.value;
    const category = form.category.value;
    const description = form.description.value;
    const price = parseInt(form.price.value);
    const quantity = parseInt(form.quantity.value);
    const image = form.image.files[0];
    const img_url = await imageUpload(image);

    //seller info
    const seller = {
      name: user?.displayName,
      image: user?.photoURL,
      email: user?.email,
    };

    const plantData = {
      name,
      category,
      description,
      price,
      quantity,
      image: img_url,
      seller,
    };

    console.table(plantData);
    try {
      //post request
      const { data } = await axiosSecure.post("/plants", plantData);
      navigate('/dashboard/my-inventory')
      toast.success("Data Added successfully!");

      console.log(data);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };
  //setLoading true if data is fetching

  return (
    <div>
      <Helmet>
        <title>Add Plant | Dashboard</title>
      </Helmet>

      {/* Form */}
      <AddPlantForm
        handleSubmit={handleSubmit}
        uploadButtonText={uploadButtonText}
        setUploadButtonText={setUploadButtonText}
        loading={loading}
      />
    </div>
  );
};

export default AddPlant;
