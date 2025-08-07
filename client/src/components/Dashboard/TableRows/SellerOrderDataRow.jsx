import PropTypes from "prop-types";
import { useState } from "react";
import DeleteModal from "../../Modal/DeleteModal";
import useAxiosSecure from "../../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
const SellerOrderDataRow = ({ orderData,refetch }) => {
  let [isOpen, setIsOpen] = useState(false);
  const closeModal = () => setIsOpen(false);
  const { name, quantity, price, address, status, customer, _id, plantId } =
    orderData || {};
  const axiosSecure = useAxiosSecure();
  const handleDelete = async () => {
    try {
      await axiosSecure.delete(`/sellerOrder/${_id}`);
      // increase quantity from plant collection
      await axiosSecure.patch(`/plants/quantify/${plantId}`, {
        quantityToUpdate: quantity,
        status: "increase",
      });

      refetch();
      toast.success("successfully Deleted!");
    } catch (err) {
      console.log(err);
      toast.error(err.response.data);
    } finally {
      closeModal();
    }
  };

   const handleStatus = async(newStatus)=>{
    if(status === newStatus) return
    try{
      await axiosSecure.patch(`/orders/${_id}`,{
      status: newStatus,
      })
      // call refetch to refresh ui
      refetch()
      toast.success('status updated')
    }
    catch(err){
      console.log(err)
      toast.error(err.response.data)
    }

  }
  return (
    <tr>
      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
        <p className="text-gray-900 whitespace-no-wrap">{name}</p>
      </td>
      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
        <p className="text-gray-900 whitespace-no-wrap">{customer?.email}</p>
      </td>
      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
        <p className="text-gray-900 whitespace-no-wrap">${price}</p>
      </td>
      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
        <p className="text-gray-900 whitespace-no-wrap">{quantity}</p>
      </td>
      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
        <p className="text-gray-900 whitespace-no-wrap">{address}</p>
      </td>
      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
        <p className="text-gray-900 whitespace-no-wrap">{status}</p>
      </td>

      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
        <div className="flex items-center gap-2">
          <select
          defaultValue={status}
          // disabled= {status === 'Delivered'}
          onChange={e=>handleStatus(e.target.value)}
            required
            className="p-1 border-2 border-lime-300 focus:outline-lime-500 rounded-md text-gray-900 whitespace-no-wrap bg-white"
            name="category"
          >
            <option value="Pending">Pending</option>
            <option value="In Progress">Start Processing</option>
            <option value="Delivered">Deliver</option>
          </select>
          <button
            onClick={() => setIsOpen(true)}
            className="relative disabled:cursor-not-allowed cursor-pointer inline-block px-3 py-1 font-semibold text-green-900 leading-tight"
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-red-200 opacity-50 rounded-full"
            ></span>
            <span className="relative">Cancel</span>
          </button>
        </div>
        <DeleteModal
          isOpen={isOpen}
          closeModal={closeModal}
          handleDelete={handleDelete}
        />
      </td>
    </tr>
  );
};

SellerOrderDataRow.propTypes = {
  order: PropTypes.object,
  refetch: PropTypes.func,
  orderData: PropTypes.object,
};

export default SellerOrderDataRow;
